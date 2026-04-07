-- Migration 018: Aggiunge ISO 16636 al catalogo norme
-- Servizi di gestione dei parassiti (Pest Management)

INSERT INTO norme_catalogo (codice, nome, ordine)
VALUES ('ISO 16636', 'Servizi di gestione dei parassiti (Pest Management)', 18)
ON CONFLICT (codice) DO NOTHING;
