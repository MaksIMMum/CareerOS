/**
 * Tiny in-memory stand-in for the DynamoDB DocumentClient, covering exactly the operations our
 * handlers use (Get/Put/Delete/Query and the Update shapes from items.ts, quota.ts, analyses.ts).
 */
type Item = Record<string, any>;

export class FakeDynamo {
  items = new Map<string, Item>();
  calls: string[] = [];

  private k(key: { PK: string; SK: string }) {
    return `${key.PK}|${key.SK}`;
  }

  get(pk: string, sk: string): Item | undefined {
    return this.items.get(`${pk}|${sk}`);
  }

  private conditionalFail(): never {
    throw Object.assign(new Error('The conditional request failed'), {
      name: 'ConditionalCheckFailedException',
    });
  }

  send = async (cmd: any): Promise<any> => {
    const name: string = cmd.constructor.name;
    const i = cmd.input;
    this.calls.push(name);
    switch (name) {
      case 'GetCommand':
        return { Item: this.items.get(this.k(i.Key)) };
      case 'PutCommand': {
        const key = this.k(i.Item);
        if (i.ConditionExpression === 'attribute_not_exists(PK)' && this.items.has(key)) this.conditionalFail();
        this.items.set(key, structuredClone(i.Item));
        return {};
      }
      case 'DeleteCommand': {
        const key = this.k(i.Key);
        if (i.ConditionExpression && !this.items.has(key)) this.conditionalFail();
        this.items.delete(key);
        return {};
      }
      case 'QueryCommand': {
        const pk = i.ExpressionAttributeValues[':pk'];
        const prefix = i.ExpressionAttributeValues[':sk'] ?? '';
        let rows = [...this.items.values()].filter((it) => it.PK === pk && String(it.SK).startsWith(prefix));
        rows.sort((a, b) => String(a.SK).localeCompare(String(b.SK)));
        if (i.ScanIndexForward === false) rows.reverse();
        if (i.Limit) rows = rows.slice(0, i.Limit);
        if (i.Select === 'COUNT') return { Count: rows.length };
        return { Items: rows.map((r) => structuredClone(r)) };
      }
      case 'UpdateCommand': {
        const key = this.k(i.Key);
        const existing = this.items.get(key);
        const names = i.ExpressionAttributeNames ?? {};
        const values = i.ExpressionAttributeValues ?? {};
        const expr: string = i.UpdateExpression;
        // quota.ts consume
        if (expr.includes('if_not_exists')) {
          const c = names['#c'];
          const cur = existing?.[c];
          if (cur !== undefined && !(cur < values[':limit'])) this.conditionalFail();
          const next = { ...(existing ?? i.Key), [c]: (cur ?? 0) + 1, ttl: values[':ttl'] };
          this.items.set(key, next);
          return { Attributes: { [c]: next[c] } };
        }
        // quota.ts refund
        if (expr === 'SET #c = #c - :one') {
          const c = names['#c'];
          if (!existing || !(existing[c] > 0)) this.conditionalFail();
          existing[c] -= 1;
          return {};
        }
        // analyses.ts share
        if (expr === 'SET shareId = :s, shareScores = :sc') {
          if (!existing || existing.shareId) this.conditionalFail();
          existing.shareId = values[':s'];
          existing.shareScores = values[':sc'];
          return {};
        }
        // items.ts update: SET #updatedAt = :updatedAt, #f0 = :f0, ...
        if (i.ConditionExpression === 'attribute_exists(PK)' && !existing) this.conditionalFail();
        for (const part of expr.replace(/^SET /, '').split(', ')) {
          const [n, v] = part.split(' = ');
          existing![names[n!]] = values[v!];
        }
        return { Attributes: structuredClone(existing) };
      }
      default:
        throw new Error(`FakeDynamo: unsupported ${name}`);
    }
  };
}
