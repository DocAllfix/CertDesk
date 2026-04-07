export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      allegati: {
        Row: {
          caricato_da: string | null
          created_at: string | null
          descrizione: string | null
          dimensione_bytes: number | null
          fase_riferimento: Database["public"]["Enums"]["fase_type"] | null
          id: string
          mime_type: string | null
          nome_file: string
          nome_originale: string
          pratica_id: string
          storage_path: string
        }
        Insert: {
          caricato_da?: string | null
          created_at?: string | null
          descrizione?: string | null
          dimensione_bytes?: number | null
          fase_riferimento?: Database["public"]["Enums"]["fase_type"] | null
          id?: string
          mime_type?: string | null
          nome_file: string
          nome_originale: string
          pratica_id: string
          storage_path: string
        }
        Update: {
          caricato_da?: string | null
          created_at?: string | null
          descrizione?: string | null
          dimensione_bytes?: number | null
          fase_riferimento?: Database["public"]["Enums"]["fase_type"] | null
          id?: string
          mime_type?: string | null
          nome_file?: string
          nome_originale?: string
          pratica_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "allegati_caricato_da_fkey"
            columns: ["caricato_da"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allegati_pratica_id_fkey"
            columns: ["pratica_id"]
            isOneToOne: false
            referencedRelation: "pratiche"
            referencedColumns: ["id"]
          },
        ]
      }
      clienti: {
        Row: {
          attivo: boolean | null
          cap: string | null
          citta: string | null
          codice_ea: string | null
          codice_fiscale: string | null
          codice_nace: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          indirizzo: string | null
          nome: string
          note: string | null
          numero_dipendenti: number | null
          pec: string | null
          piva: string | null
          ragione_sociale: string | null
          telefono: string | null
          updated_at: string | null
        }
        Insert: {
          attivo?: boolean | null
          cap?: string | null
          citta?: string | null
          codice_ea?: string | null
          codice_fiscale?: string | null
          codice_nace?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          indirizzo?: string | null
          nome: string
          note?: string | null
          numero_dipendenti?: number | null
          pec?: string | null
          piva?: string | null
          ragione_sociale?: string | null
          telefono?: string | null
          updated_at?: string | null
        }
        Update: {
          attivo?: boolean | null
          cap?: string | null
          citta?: string | null
          codice_ea?: string | null
          codice_fiscale?: string | null
          codice_nace?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          indirizzo?: string | null
          nome?: string
          note?: string | null
          numero_dipendenti?: number | null
          pec?: string | null
          piva?: string | null
          ragione_sociale?: string | null
          telefono?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clienti_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consulenti: {
        Row: {
          attivo: boolean | null
          azienda: string | null
          cognome: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          nome: string
          note: string | null
          telefono: string | null
        }
        Insert: {
          attivo?: boolean | null
          azienda?: string | null
          cognome?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          nome: string
          note?: string | null
          telefono?: string | null
        }
        Update: {
          attivo?: boolean | null
          azienda?: string | null
          cognome?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          nome?: string
          note?: string | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consulenti_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consulenti_norme: {
        Row: {
          consulente_id: string
          norma_codice: string
        }
        Insert: {
          consulente_id: string
          norma_codice: string
        }
        Update: {
          consulente_id?: string
          norma_codice?: string
        }
        Relationships: [
          {
            foreignKeyName: "consulenti_norme_consulente_id_fkey"
            columns: ["consulente_id"]
            isOneToOne: false
            referencedRelation: "consulenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consulenti_norme_norma_codice_fkey"
            columns: ["norma_codice"]
            isOneToOne: false
            referencedRelation: "norme_catalogo"
            referencedColumns: ["codice"]
          },
        ]
      }
      messaggi_interni: {
        Row: {
          allegato_id: string | null
          autore_id: string
          created_at: string | null
          destinatario_id: string | null
          id: string
          letto_da: string[] | null
          pratica_id: string
          testo: string
          tipo: Database["public"]["Enums"]["messaggio_tipo"]
        }
        Insert: {
          allegato_id?: string | null
          autore_id: string
          created_at?: string | null
          destinatario_id?: string | null
          id?: string
          letto_da?: string[] | null
          pratica_id: string
          testo: string
          tipo?: Database["public"]["Enums"]["messaggio_tipo"]
        }
        Update: {
          allegato_id?: string | null
          autore_id?: string
          created_at?: string | null
          destinatario_id?: string | null
          id?: string
          letto_da?: string[] | null
          pratica_id?: string
          testo?: string
          tipo?: Database["public"]["Enums"]["messaggio_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "messaggi_interni_allegato_id_fkey"
            columns: ["allegato_id"]
            isOneToOne: false
            referencedRelation: "allegati"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messaggi_interni_autore_id_fkey"
            columns: ["autore_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messaggi_interni_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messaggi_interni_pratica_id_fkey"
            columns: ["pratica_id"]
            isOneToOne: false
            referencedRelation: "pratiche"
            referencedColumns: ["id"]
          },
        ]
      }
      norme_catalogo: {
        Row: {
          codice: string
          nome: string
          ordine: number | null
        }
        Insert: {
          codice: string
          nome: string
          ordine?: number | null
        }
        Update: {
          codice?: string
          nome?: string
          ordine?: number | null
        }
        Relationships: []
      }
      notifiche: {
        Row: {
          azione_url: string | null
          created_at: string | null
          destinatario_id: string
          id: string
          letta: boolean | null
          letta_at: string | null
          messaggio: string
          mittente_id: string | null
          pratica_id: string | null
          tipo: Database["public"]["Enums"]["notifica_tipo"]
          titolo: string
        }
        Insert: {
          azione_url?: string | null
          created_at?: string | null
          destinatario_id: string
          id?: string
          letta?: boolean | null
          letta_at?: string | null
          messaggio: string
          mittente_id?: string | null
          pratica_id?: string | null
          tipo?: Database["public"]["Enums"]["notifica_tipo"]
          titolo: string
        }
        Update: {
          azione_url?: string | null
          created_at?: string | null
          destinatario_id?: string
          id?: string
          letta?: boolean | null
          letta_at?: string | null
          messaggio?: string
          mittente_id?: string | null
          pratica_id?: string | null
          tipo?: Database["public"]["Enums"]["notifica_tipo"]
          titolo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifiche_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifiche_mittente_id_fkey"
            columns: ["mittente_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifiche_pratica_id_fkey"
            columns: ["pratica_id"]
            isOneToOne: false
            referencedRelation: "pratiche"
            referencedColumns: ["id"]
          },
        ]
      }
      pratiche: {
        Row: {
          archiviata: boolean | null
          assegnato_a: string | null
          auditor_id: string | null
          ciclo: Database["public"]["Enums"]["ciclo_type"]
          cliente_id: string
          completata: boolean | null
          completata_at: string | null
          consulente_id: string | null
          created_at: string | null
          created_by: string | null
          data_emissione_certificato: string | null
          data_prossima_sorveglianza: string | null
          data_scadenza: string | null
          data_scadenza_certificato: string | null
          data_verifica: string | null
          documenti_ricevuti: boolean | null
          documenti_ricevuti_at: string | null
          fase: Database["public"]["Enums"]["fase_type"]
          id: string
          motivo_stato: string | null
          note: string | null
          numero_certificato: string | null
          numero_pratica: string | null
          priorita: number | null
          proforma_emessa: boolean | null
          proforma_emessa_at: string | null
          proforma_richiesta: boolean | null
          proforma_richiesta_at: string | null
          referente_email: string | null
          referente_nome: string | null
          referente_tel: string | null
          sede_verifica: string | null
          sorveglianza_reminder_creato: boolean | null
          stato: Database["public"]["Enums"]["stato_pratica_type"]
          stato_cambiato_at: string | null
          stato_cambiato_da: string | null
          tipo_contatto: Database["public"]["Enums"]["contatto_type"]
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          archiviata?: boolean | null
          assegnato_a?: string | null
          auditor_id?: string | null
          ciclo: Database["public"]["Enums"]["ciclo_type"]
          cliente_id: string
          completata?: boolean | null
          completata_at?: string | null
          consulente_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_emissione_certificato?: string | null
          data_prossima_sorveglianza?: string | null
          data_scadenza?: string | null
          data_scadenza_certificato?: string | null
          data_verifica?: string | null
          documenti_ricevuti?: boolean | null
          documenti_ricevuti_at?: string | null
          fase?: Database["public"]["Enums"]["fase_type"]
          id?: string
          motivo_stato?: string | null
          note?: string | null
          numero_certificato?: string | null
          numero_pratica?: string | null
          priorita?: number | null
          proforma_emessa?: boolean | null
          proforma_emessa_at?: string | null
          proforma_richiesta?: boolean | null
          proforma_richiesta_at?: string | null
          referente_email?: string | null
          referente_nome?: string | null
          referente_tel?: string | null
          sede_verifica?: string | null
          sorveglianza_reminder_creato?: boolean | null
          stato?: Database["public"]["Enums"]["stato_pratica_type"]
          stato_cambiato_at?: string | null
          stato_cambiato_da?: string | null
          tipo_contatto?: Database["public"]["Enums"]["contatto_type"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          archiviata?: boolean | null
          assegnato_a?: string | null
          auditor_id?: string | null
          ciclo?: Database["public"]["Enums"]["ciclo_type"]
          cliente_id?: string
          completata?: boolean | null
          completata_at?: string | null
          consulente_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_emissione_certificato?: string | null
          data_prossima_sorveglianza?: string | null
          data_scadenza?: string | null
          data_scadenza_certificato?: string | null
          data_verifica?: string | null
          documenti_ricevuti?: boolean | null
          documenti_ricevuti_at?: string | null
          fase?: Database["public"]["Enums"]["fase_type"]
          id?: string
          motivo_stato?: string | null
          note?: string | null
          numero_certificato?: string | null
          numero_pratica?: string | null
          priorita?: number | null
          proforma_emessa?: boolean | null
          proforma_emessa_at?: string | null
          proforma_richiesta?: boolean | null
          proforma_richiesta_at?: string | null
          referente_email?: string | null
          referente_nome?: string | null
          referente_tel?: string | null
          sede_verifica?: string | null
          sorveglianza_reminder_creato?: boolean | null
          stato?: Database["public"]["Enums"]["stato_pratica_type"]
          stato_cambiato_at?: string | null
          stato_cambiato_da?: string | null
          tipo_contatto?: Database["public"]["Enums"]["contatto_type"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pratiche_assegnato_a_fkey"
            columns: ["assegnato_a"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pratiche_auditor_id_fkey"
            columns: ["auditor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pratiche_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pratiche_consulente_id_fkey"
            columns: ["consulente_id"]
            isOneToOne: false
            referencedRelation: "consulenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pratiche_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pratiche_stato_cambiato_da_fkey"
            columns: ["stato_cambiato_da"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pratiche_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pratiche_norme: {
        Row: {
          norma_codice: string
          pratica_id: string
        }
        Insert: {
          norma_codice: string
          pratica_id: string
        }
        Update: {
          norma_codice?: string
          pratica_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pratiche_norme_norma_codice_fkey"
            columns: ["norma_codice"]
            isOneToOne: false
            referencedRelation: "norme_catalogo"
            referencedColumns: ["codice"]
          },
          {
            foreignKeyName: "pratiche_norme_pratica_id_fkey"
            columns: ["pratica_id"]
            isOneToOne: false
            referencedRelation: "pratiche"
            referencedColumns: ["id"]
          },
        ]
      }
      promemoria: {
        Row: {
          assegnato_a: string | null
          completato: boolean | null
          completato_at: string | null
          created_at: string | null
          creato_da: string
          data_scadenza: string | null
          id: string
          pratica_id: string | null
          testo: string
        }
        Insert: {
          assegnato_a?: string | null
          completato?: boolean | null
          completato_at?: string | null
          created_at?: string | null
          creato_da: string
          data_scadenza?: string | null
          id?: string
          pratica_id?: string | null
          testo: string
        }
        Update: {
          assegnato_a?: string | null
          completato?: boolean | null
          completato_at?: string | null
          created_at?: string | null
          creato_da?: string
          data_scadenza?: string | null
          id?: string
          pratica_id?: string | null
          testo?: string
        }
        Relationships: [
          {
            foreignKeyName: "promemoria_assegnato_a_fkey"
            columns: ["assegnato_a"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promemoria_creato_da_fkey"
            columns: ["creato_da"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promemoria_pratica_id_fkey"
            columns: ["pratica_id"]
            isOneToOne: false
            referencedRelation: "pratiche"
            referencedColumns: ["id"]
          },
        ]
      }
      responsabili_norme: {
        Row: {
          norma_codice: string
          user_id: string
        }
        Insert: {
          norma_codice: string
          user_id: string
        }
        Update: {
          norma_codice?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "responsabili_norme_norma_codice_fkey"
            columns: ["norma_codice"]
            isOneToOne: false
            referencedRelation: "norme_catalogo"
            referencedColumns: ["codice"]
          },
          {
            foreignKeyName: "responsabili_norme_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      storico_fasi: {
        Row: {
          cambiato_da: string | null
          created_at: string | null
          dati_aggiuntivi: Json | null
          fase_nuova: Database["public"]["Enums"]["fase_type"]
          fase_precedente: Database["public"]["Enums"]["fase_type"] | null
          id: string
          motivo: string | null
          pratica_id: string
        }
        Insert: {
          cambiato_da?: string | null
          created_at?: string | null
          dati_aggiuntivi?: Json | null
          fase_nuova: Database["public"]["Enums"]["fase_type"]
          fase_precedente?: Database["public"]["Enums"]["fase_type"] | null
          id?: string
          motivo?: string | null
          pratica_id: string
        }
        Update: {
          cambiato_da?: string | null
          created_at?: string | null
          dati_aggiuntivi?: Json | null
          fase_nuova?: Database["public"]["Enums"]["fase_type"]
          fase_precedente?: Database["public"]["Enums"]["fase_type"] | null
          id?: string
          motivo?: string | null
          pratica_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "storico_fasi_cambiato_da_fkey"
            columns: ["cambiato_da"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storico_fasi_pratica_id_fkey"
            columns: ["pratica_id"]
            isOneToOne: false
            referencedRelation: "pratiche"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          attivo: boolean | null
          avatar_url: string | null
          cognome: string | null
          created_at: string | null
          id: string
          nome: string
          ruolo: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          attivo?: boolean | null
          avatar_url?: string | null
          cognome?: string | null
          created_at?: string | null
          id: string
          nome: string
          ruolo?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          attivo?: boolean | null
          avatar_url?: string | null
          cognome?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          ruolo?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      crea_notifica: {
        Args: {
          p_destinatario_id: string
          p_messaggio: string
          p_pratica_id: string
          p_tipo: Database["public"]["Enums"]["notifica_tipo"]
          p_titolo: string
        }
        Returns: string
      }
      get_pratiche_scadenze: {
        Args: { giorni_avviso: number }
        Returns: {
          archiviata: boolean | null
          assegnato_a: string | null
          auditor_id: string | null
          ciclo: Database["public"]["Enums"]["ciclo_type"]
          cliente_id: string
          completata: boolean | null
          completata_at: string | null
          consulente_id: string | null
          created_at: string | null
          created_by: string | null
          data_emissione_certificato: string | null
          data_prossima_sorveglianza: string | null
          data_scadenza: string | null
          data_scadenza_certificato: string | null
          data_verifica: string | null
          documenti_ricevuti: boolean | null
          documenti_ricevuti_at: string | null
          fase: Database["public"]["Enums"]["fase_type"]
          id: string
          motivo_stato: string | null
          note: string | null
          numero_certificato: string | null
          numero_pratica: string | null
          priorita: number | null
          proforma_emessa: boolean | null
          proforma_emessa_at: string | null
          proforma_richiesta: boolean | null
          proforma_richiesta_at: string | null
          referente_email: string | null
          referente_nome: string | null
          referente_tel: string | null
          sede_verifica: string | null
          sorveglianza_reminder_creato: boolean | null
          stato: Database["public"]["Enums"]["stato_pratica_type"]
          stato_cambiato_at: string | null
          stato_cambiato_da: string | null
          tipo_contatto: Database["public"]["Enums"]["contatto_type"]
          updated_at: string | null
          updated_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "pratiche"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_statistiche_dashboard: { Args: { p_user_id?: string }; Returns: Json }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
    }
    Enums: {
      ciclo_type:
        | "certificazione"
        | "prima_sorveglianza"
        | "seconda_sorveglianza"
        | "ricertificazione"
      contatto_type: "consulente" | "diretto"
      fase_type:
        | "contratto_firmato"
        | "programmazione_verifica"
        | "richiesta_proforma"
        | "elaborazione_pratica"
        | "firme"
        | "completata"
      messaggio_tipo: "commento" | "richiesta" | "risposta" | "sistema"
      notifica_tipo:
        | "info"
        | "warning"
        | "critical"
        | "success"
        | "richiesta"
        | "sistema"
      stato_pratica_type: "attiva" | "annullata" | "sospesa"
      user_role: "admin" | "responsabile" | "operatore"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ciclo_type: [
        "certificazione",
        "prima_sorveglianza",
        "seconda_sorveglianza",
        "ricertificazione",
      ],
      contatto_type: ["consulente", "diretto"],
      fase_type: [
        "contratto_firmato",
        "programmazione_verifica",
        "richiesta_proforma",
        "elaborazione_pratica",
        "firme",
        "completata",
      ],
      messaggio_tipo: ["commento", "richiesta", "risposta", "sistema"],
      notifica_tipo: [
        "info",
        "warning",
        "critical",
        "success",
        "richiesta",
        "sistema",
      ],
      stato_pratica_type: ["attiva", "annullata", "sospesa"],
      user_role: ["admin", "responsabile", "operatore"],
    },
  },
} as const
