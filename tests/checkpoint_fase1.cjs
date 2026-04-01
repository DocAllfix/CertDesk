/**
 * CHECKPOINT FASE 1 — Verifica completa e approfondita
 * Controlla ogni singolo punto del checklist contro il database reale
 */

const https = require('https');

const PROJECT_REF = 'nqaagqyuzcwzocoubsrj';
const ACCESS_TOKEN = 'sbp_2b0f293478c5c5d32ec316f118569056cdd0c918';

function runSQL(query) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query });
    const options = {
      hostname: 'api.supabase.com',
      port: 443,
      path: `/v1/projects/${PROJECT_REF}/database/query`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  let passed = 0;
  let failed = 0;
  let warnings = 0;

  function pass(msg) { passed++; console.log(`   ✅ ${msg}`); }
  function fail(msg) { failed++; console.log(`   ❌ ${msg}`); }
  function warn(msg) { warnings++; console.log(`   ⚠️  ${msg}`); }

  console.log('═'.repeat(70));
  console.log('CHECKPOINT FASE 1 — VERIFICA COMPLETA');
  console.log('═'.repeat(70));
  console.log('');

  // ============================================================
  // CHECK 1: TABELLE — verificare che tutte e 13 esistono
  // ============================================================
  console.log('─'.repeat(70));
  console.log('CHECK 1: Tutte le 13 tabelle esistono nel database');
  console.log('─'.repeat(70));

  const tablesResult = await runSQL(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  const expectedTables = [
    'allegati', 'clienti', 'consulenti', 'consulenti_norme',
    'messaggi_interni', 'norme_catalogo', 'notifiche',
    'pratiche', 'pratiche_norme', 'promemoria',
    'responsabili_norme', 'storico_fasi', 'user_profiles'
  ];

  if (tablesResult.status === 200 || tablesResult.status === 201) {
    const dbTables = tablesResult.data.map(r => r.table_name).sort();
    expectedTables.forEach(t => {
      if (dbTables.includes(t)) {
        pass(`Tabella '${t}' presente`);
      } else {
        fail(`Tabella '${t}' MANCANTE`);
      }
    });
    // Check for extra tables
    dbTables.forEach(t => {
      if (!expectedTables.includes(t)) {
        warn(`Tabella extra trovata: '${t}'`);
      }
    });
  } else {
    fail('Query tabelle fallita: ' + JSON.stringify(tablesResult.data));
  }
  console.log('');

  // ============================================================
  // CHECK 2: RLS abilitata su OGNI tabella
  // ============================================================
  console.log('─'.repeat(70));
  console.log('CHECK 2: RLS abilitata su ogni tabella');
  console.log('─'.repeat(70));

  const rlsResult = await runSQL(`
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `);

  if (rlsResult.status === 200 || rlsResult.status === 201) {
    rlsResult.data.forEach(r => {
      if (expectedTables.includes(r.tablename)) {
        if (r.rowsecurity === true) {
          pass(`RLS abilitata su '${r.tablename}'`);
        } else {
          fail(`RLS NON abilitata su '${r.tablename}'!`);
        }
      }
    });
  } else {
    fail('Query RLS fallita');
  }
  console.log('');

  // ============================================================
  // CHECK 3: Conteggio policies per tabella (totale = 37)
  // ============================================================
  console.log('─'.repeat(70));
  console.log('CHECK 3: 37 RLS policies (conteggio per tabella)');
  console.log('─'.repeat(70));

  const policiesResult = await runSQL(`
    SELECT schemaname, tablename, policyname, cmd, permissive
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `);

  if (policiesResult.status === 200 || policiesResult.status === 201) {
    const policies = policiesResult.data;
    const byTable = {};
    policies.forEach(p => {
      if (!byTable[p.tablename]) byTable[p.tablename] = [];
      byTable[p.tablename].push(p.policyname);
    });

    const expectedPolicyCounts = {
      'user_profiles': 3, 'clienti': 3, 'consulenti': 3,
      'norme_catalogo': 4, 'pratiche': 4, 'allegati': 4,
      'storico_fasi': 1, 'notifiche': 3, 'messaggi_interni': 4,
      'promemoria': 4, 'pratiche_norme': 3, 'responsabili_norme': 3,
      'consulenti_norme': 3
    };

    let totalPolicies = 0;
    Object.entries(expectedPolicyCounts).forEach(([table, expected]) => {
      const actual = (byTable[table] || []).length;
      totalPolicies += actual;
      if (actual === expected) {
        pass(`${table}: ${actual} policies (atteso: ${expected})`);
      } else {
        fail(`${table}: ${actual} policies (atteso: ${expected}!) — ${JSON.stringify(byTable[table])}`);
      }
    });

    if (totalPolicies === 37) {
      pass(`TOTALE: ${totalPolicies} policies (atteso: 37)`);
    } else {
      fail(`TOTALE: ${totalPolicies} policies (atteso: 37!)`);
    }

    // Check storico_fasi is SELECT-only (immutability)
    const storicoOps = policies.filter(p => p.tablename === 'storico_fasi').map(p => p.cmd);
    if (storicoOps.length === 1 && storicoOps[0] === 'SELECT') {
      pass('storico_fasi: solo policy SELECT (immutabilità garantita)');
    } else {
      fail(`storico_fasi: ha policy non-SELECT: ${JSON.stringify(storicoOps)}`);
    }

    // Check notifiche has no INSERT policy (forced via crea_notifica)
    const notificheOps = policies.filter(p => p.tablename === 'notifiche').map(p => p.cmd);
    if (!notificheOps.includes('INSERT')) {
      pass('notifiche: nessuna policy INSERT (forzato uso crea_notifica SECURITY DEFINER)');
    } else {
      fail('notifiche: ha policy INSERT (non dovrebbe — forza crea_notifica)');
    }
  } else {
    fail('Query policies fallita');
  }
  console.log('');

  // ============================================================
  // CHECK 4: Funzioni helper con GRANT corretti
  // ============================================================
  console.log('─'.repeat(70));
  console.log('CHECK 4: Funzioni helper con SECURITY DEFINER e GRANT');
  console.log('─'.repeat(70));

  const functionsResult = await runSQL(`
    SELECT p.proname AS name,
           p.prosecdef AS security_definer,
           p.provolatile AS volatility
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname IN (
      'get_user_role', 'crea_notifica', 'get_pratiche_scadenze',
      'get_statistiche_dashboard', 'genera_numero_pratica',
      'validate_fase_transition', 'protect_fase_flags',
      'on_pratica_completata', 'log_cambio_fase', 'update_updated_at'
    )
    ORDER BY p.proname;
  `);

  if (functionsResult.status === 200 || functionsResult.status === 201) {
    const funcs = functionsResult.data;
    const funcMap = {};
    funcs.forEach(f => funcMap[f.name] = f);

    // Must be SECURITY DEFINER
    const mustBeSecDef = ['get_user_role', 'crea_notifica', 'get_statistiche_dashboard', 'log_cambio_fase', 'on_pratica_completata'];
    mustBeSecDef.forEach(name => {
      if (funcMap[name]) {
        if (funcMap[name].security_definer === true) {
          pass(`${name}() — SECURITY DEFINER ✓`);
        } else {
          fail(`${name}() — NON è SECURITY DEFINER!`);
        }
      } else {
        fail(`${name}() — funzione MANCANTE!`);
      }
    });

    // Check all expected functions exist
    const allExpected = ['get_user_role', 'crea_notifica', 'get_pratiche_scadenze', 'get_statistiche_dashboard', 'genera_numero_pratica', 'validate_fase_transition', 'protect_fase_flags', 'on_pratica_completata', 'log_cambio_fase', 'update_updated_at'];
    allExpected.forEach(name => {
      if (funcMap[name]) {
        pass(`${name}() — funzione presente`);
      } else {
        fail(`${name}() — funzione MANCANTE!`);
      }
    });
  } else {
    fail('Query funzioni fallita');
  }
  console.log('');

  // ============================================================
  // CHECK 5: GRANT su funzioni critiche
  // ============================================================
  console.log('─'.repeat(70));
  console.log('CHECK 5: REVOKE/GRANT su funzioni critiche');
  console.log('─'.repeat(70));

  const grantResult = await runSQL(`
    SELECT routine_name, grantee, privilege_type
    FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
    AND routine_name IN ('get_user_role', 'crea_notifica', 'get_statistiche_dashboard')
    ORDER BY routine_name, grantee;
  `);

  if (grantResult.status === 200 || grantResult.status === 201) {
    const grants = grantResult.data;
    const byFunc = {};
    grants.forEach(g => {
      if (!byFunc[g.routine_name]) byFunc[g.routine_name] = [];
      byFunc[g.routine_name].push(g.grantee);
    });

    ['get_user_role', 'crea_notifica', 'get_statistiche_dashboard'].forEach(fn => {
      const grantees = byFunc[fn] || [];
      if (grantees.includes('authenticated')) {
        pass(`${fn}() — GRANT TO authenticated ✓`);
      } else {
        warn(`${fn}() — authenticated non trovato nei grantee: ${JSON.stringify(grantees)}`);
      }
      if (grantees.includes('PUBLIC') || grantees.includes('public')) {
        fail(`${fn}() — GRANT TO PUBLIC presente (dovrebbe essere REVOKED)!`);
      } else {
        pass(`${fn}() — nessun GRANT TO PUBLIC (REVOKE corretto)`);
      }
    });
  } else {
    fail('Query GRANT fallita');
  }
  console.log('');

  // ============================================================
  // CHECK 6: Trigger presenti
  // ============================================================
  console.log('─'.repeat(70));
  console.log('CHECK 6: Tutti i trigger presenti');
  console.log('─'.repeat(70));

  const triggersResult = await runSQL(`
    SELECT trigger_name, event_object_table, action_timing, event_manipulation
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    ORDER BY event_object_table, trigger_name;
  `);

  if (triggersResult.status === 200 || triggersResult.status === 201) {
    const triggers = triggersResult.data;
    const triggerNames = triggers.map(t => t.trigger_name);

    const expectedTriggers = [
      'set_numero_pratica', 'check_fase_transition', 'check_fase_flags',
      'pratica_completata_reminder', 'log_fase_change',
      'pratiche_updated_at', 'clienti_updated_at'
    ];

    expectedTriggers.forEach(name => {
      if (triggerNames.includes(name)) {
        const t = triggers.find(tr => tr.trigger_name === name);
        pass(`Trigger '${name}' — ${t.action_timing} ${t.event_manipulation} ON ${t.event_object_table}`);
      } else {
        fail(`Trigger '${name}' MANCANTE!`);
      }
    });
  } else {
    fail('Query trigger fallita');
  }
  console.log('');

  // ============================================================
  // CHECK 7: Seed data — norme_catalogo con 17 norme
  // ============================================================
  console.log('─'.repeat(70));
  console.log('CHECK 7: Seed data — norme_catalogo con 17 norme');
  console.log('─'.repeat(70));

  const normeResult = await runSQL(`
    SELECT codice, nome, ordine
    FROM norme_catalogo
    ORDER BY ordine;
  `);

  if (normeResult.status === 200 || normeResult.status === 201) {
    const norme = normeResult.data;
    if (norme.length === 17) {
      pass(`norme_catalogo: ${norme.length} norme presenti (atteso: 17)`);
    } else {
      fail(`norme_catalogo: ${norme.length} norme (atteso: 17!)`);
    }

    // Verify specific norms
    const expectedNorms = ['ISO 9001', 'ISO 14001', 'ISO 45001', 'SA 8000', 'PAS 24000',
      'PDR 125/2022', 'ESG-EASI', 'ISO 37001', 'ISO 39001', 'ISO 50001',
      'ISO 27001', 'ISO 14064-1', 'ISO 30415', 'ISO 13009', 'ISO 20121',
      'EN 1090', 'ISO 3834'];
    const dbCodes = norme.map(n => n.codice);
    let normeOk = true;
    expectedNorms.forEach(code => {
      if (!dbCodes.includes(code)) {
        fail(`Norma '${code}' MANCANTE in norme_catalogo!`);
        normeOk = false;
      }
    });
    if (normeOk) {
      pass('Tutte le 17 norme ISO presenti e corrette');
    }
  } else {
    fail('Query norme_catalogo fallita');
  }
  console.log('');

  // ============================================================
  // CHECK 8: Indici di performance
  // ============================================================
  console.log('─'.repeat(70));
  console.log('CHECK 8: Indici di performance presenti');
  console.log('─'.repeat(70));

  const indexResult = await runSQL(`
    SELECT indexname, tablename
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%'
    ORDER BY tablename, indexname;
  `);

  if (indexResult.status === 200 || indexResult.status === 201) {
    const indexes = indexResult.data;
    const expectedIndexes = [
      'idx_pratiche_cliente', 'idx_pratiche_assegnato', 'idx_pratiche_fase',
      'idx_pratiche_stato', 'idx_pratiche_scadenza', 'idx_pratiche_fase_assegnato',
      'idx_pratiche_stato_fase',
      'idx_notifiche_destinatario', 'idx_notifiche_pratica',
      'idx_messaggi_pratica',
      'idx_allegati_pratica',
      'idx_storico_pratica',
      'idx_promemoria_assegnato', 'idx_promemoria_pratica',
      'idx_pratiche_norme_norma', 'idx_responsabili_norme_norma', 'idx_consulenti_norme_norma'
    ];

    const indexNames = indexes.map(i => i.indexname);
    expectedIndexes.forEach(name => {
      if (indexNames.includes(name)) {
        pass(`Indice '${name}' presente`);
      } else {
        fail(`Indice '${name}' MANCANTE!`);
      }
    });
  } else {
    fail('Query indici fallita');
  }
  console.log('');

  // ============================================================
  // CHECK 9: Enums corretti
  // ============================================================
  console.log('─'.repeat(70));
  console.log('CHECK 9: Enums PostgreSQL presenti e corretti');
  console.log('─'.repeat(70));

  const enumsResult = await runSQL(`
    SELECT t.typname AS enum_name, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS values
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public'
    GROUP BY t.typname
    ORDER BY t.typname;
  `);

  if (enumsResult.status === 200 || enumsResult.status === 201) {
    const enums = enumsResult.data;
    const enumMap = {};
    enums.forEach(e => enumMap[e.enum_name] = e.values);

    const expectedEnums = {
      'user_role': ['admin', 'responsabile', 'operatore'],
      'ciclo_type': ['certificazione', 'prima_sorveglianza', 'seconda_sorveglianza', 'ricertificazione'],
      'fase_type': ['contratto_firmato', 'programmazione_verifica', 'richiesta_proforma', 'elaborazione_pratica', 'firme', 'completata'],
      'stato_pratica_type': ['attiva', 'annullata', 'sospesa'],
      'contatto_type': ['consulente', 'diretto'],
      'notifica_tipo': ['info', 'warning', 'critical', 'success', 'richiesta', 'sistema'],
      'messaggio_tipo': ['commento', 'richiesta', 'risposta', 'sistema']
    };

    Object.entries(expectedEnums).forEach(([name, values]) => {
      if (enumMap[name]) {
        const dbValues = enumMap[name];
        if (JSON.stringify(dbValues.sort()) === JSON.stringify(values.sort())) {
          pass(`Enum '${name}': ${values.length} valori corretti`);
        } else {
          fail(`Enum '${name}' valori non corrispondono! DB: ${JSON.stringify(dbValues)}, Atteso: ${JSON.stringify(values)}`);
        }
      } else {
        fail(`Enum '${name}' MANCANTE!`);
      }
    });
  } else {
    fail('Query enums fallita');
  }
  console.log('');

  // ============================================================
  // CHECK 10: Database vuoto (no dati test residui)
  // ============================================================
  console.log('─'.repeat(70));
  console.log('CHECK 10: Database pulito (no dati test residui)');
  console.log('─'.repeat(70));

  const cleanResult = await runSQL(`
    SELECT 'pratiche' AS tab, COUNT(*) AS cnt FROM pratiche
    UNION ALL SELECT 'storico_fasi', COUNT(*) FROM storico_fasi
    UNION ALL SELECT 'promemoria', COUNT(*) FROM promemoria
    UNION ALL SELECT 'notifiche', COUNT(*) FROM notifiche
    UNION ALL SELECT 'user_profiles', COUNT(*) FROM user_profiles
    UNION ALL SELECT 'clienti', COUNT(*) FROM clienti
    ORDER BY tab;
  `);

  if (cleanResult.status === 200 || cleanResult.status === 201) {
    cleanResult.data.forEach(r => {
      if (parseInt(r.cnt) === 0) {
        pass(`${r.tab}: vuota (nessun dato residuo)`);
      } else {
        warn(`${r.tab}: ${r.cnt} record (verificare se sono dati di seed o test residui)`);
      }
    });
  }
  console.log('');

  // ============================================================
  // RIEPILOGO FINALE
  // ============================================================
  console.log('═'.repeat(70));
  console.log('RIEPILOGO CHECKPOINT FASE 1');
  console.log('═'.repeat(70));
  console.log(`   ✅ PASSATI:    ${passed}`);
  console.log(`   ❌ FALLITI:    ${failed}`);
  console.log(`   ⚠️  AVVISI:    ${warnings}`);
  console.log('');

  if (failed === 0) {
    console.log('   🎉 CHECKPOINT FASE 1 SUPERATO — Pronto per FASE 2');
  } else {
    console.log(`   🚫 CHECKPOINT NON SUPERATO — ${failed} problemi da risolvere`);
  }
  console.log('═'.repeat(70));
}

main().catch(err => {
  console.error('Errore fatale:', err);
  process.exit(1);
});
