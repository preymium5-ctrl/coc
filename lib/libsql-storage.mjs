// D1's small query interface over durable remote libSQL storage on Vercel.
// The browser never receives the database URL or token.
export function libsqlStorage(client){
  const result=value=>({success:true,results:value.rows.map(row=>Object.fromEntries(Object.entries(row))),meta:{changes:value.rowsAffected,last_row_id:Number(value.lastInsertRowid||0)}});
  const prepare=(sql,args=[])=>({
    statement:{sql,args},
    bind(...values){return prepare(sql,values);},
    async first(column){const rows=(await client.execute({sql,args})).rows;return rows.length?(column===undefined?Object.fromEntries(Object.entries(rows[0])):rows[0][column]):null;},
    async all(){return result(await client.execute({sql,args}));},
    async run(){return result(await client.execute({sql,args}));},
    async raw(){const value=await client.execute({sql,args});return value.rows.map(row=>value.columns.map(column=>row[column]));},
  });
  return {prepare,async batch(statements){return (await client.batch(statements.map(value=>value.statement),'write')).map(result);}};
}
