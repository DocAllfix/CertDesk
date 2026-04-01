const https = require('https');
const d = JSON.stringify({query: "SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname;"});
const o = {hostname:'api.supabase.com',port:443,path:'/v1/projects/nqaagqyuzcwzocoubsrj/database/query',method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer sbp_2b0f293478c5c5d32ec316f118569056cdd0c918'}};
const r = https.request(o, res => {let b='';res.on('data',c=>b+=c);res.on('end',()=>{
  const data = JSON.parse(b);
  // count by table
  const byTable = {};
  data.forEach(p => {
    if (!byTable[p.tablename]) byTable[p.tablename] = [];
    byTable[p.tablename].push({name: p.policyname, cmd: p.cmd});
  });
  console.log('Total policies:', data.length);
  Object.entries(byTable).forEach(([table, policies]) => {
    console.log(`\n${table} (${policies.length}):`);
    policies.forEach(p => console.log(`  - ${p.name} [${p.cmd}]`));
  });
});});
r.write(d);r.end();
