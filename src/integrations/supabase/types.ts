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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      aktivitas: {
        Row: {
          created_at: string
          deskripsi: string
          id: string
          tipe: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deskripsi: string
          id?: string
          tipe: string
          user_id: string
        }
        Update: {
          created_at?: string
          deskripsi?: string
          id?: string
          tipe?: string
          user_id?: string
        }
        Relationships: []
      }
      belanja_bulanan: {
        Row: {
          budget: number
          budget_lain: number
          bulan: number
          created_at: string
          id: string
          selesai_at: string | null
          status: string
          tahun: number
          user_id: string
        }
        Insert: {
          budget?: number
          budget_lain?: number
          bulan: number
          created_at?: string
          id?: string
          selesai_at?: string | null
          status?: string
          tahun: number
          user_id: string
        }
        Update: {
          budget?: number
          budget_lain?: number
          bulan?: number
          created_at?: string
          id?: string
          selesai_at?: string | null
          status?: string
          tahun?: number
          user_id?: string
        }
        Relationships: []
      }
      belanja_item: {
        Row: {
          belanja_id: string
          created_at: string
          dibeli_at: string | null
          estimasi_harga: number
          harga_aktual: number | null
          id: string
          item_id: string | null
          jumlah: number
          kategori_barang_id: string | null
          merk: string | null
          nama_snapshot: string
          satuan: string
          sudah_dibeli: boolean
          toko_id: string | null
          user_id: string
        }
        Insert: {
          belanja_id: string
          created_at?: string
          dibeli_at?: string | null
          estimasi_harga?: number
          harga_aktual?: number | null
          id?: string
          item_id?: string | null
          jumlah?: number
          kategori_barang_id?: string | null
          merk?: string | null
          nama_snapshot: string
          satuan?: string
          sudah_dibeli?: boolean
          toko_id?: string | null
          user_id: string
        }
        Update: {
          belanja_id?: string
          created_at?: string
          dibeli_at?: string | null
          estimasi_harga?: number
          harga_aktual?: number | null
          id?: string
          item_id?: string | null
          jumlah?: number
          kategori_barang_id?: string | null
          merk?: string | null
          nama_snapshot?: string
          satuan?: string
          sudah_dibeli?: boolean
          toko_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "belanja_item_belanja_id_fkey"
            columns: ["belanja_id"]
            isOneToOne: false
            referencedRelation: "belanja_bulanan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "belanja_item_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "belanja_item_kategori_barang_id_fkey"
            columns: ["kategori_barang_id"]
            isOneToOne: false
            referencedRelation: "kategori_barang"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "belanja_item_toko_id_fkey"
            columns: ["toko_id"]
            isOneToOne: false
            referencedRelation: "toko"
            referencedColumns: ["id"]
          },
        ]
      }
      default_item_kategori: {
        Row: {
          created_at: string
          id: string
          item_id: string
          kategori_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          kategori_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          kategori_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "default_item_kategori_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "default_item_kategori_kategori_user_id_fkey"
            columns: ["kategori_user_id"]
            isOneToOne: false
            referencedRelation: "kategori_user"
            referencedColumns: ["id"]
          },
        ]
      }
      histori_harga: {
        Row: {
          created_at: string
          harga: number
          id: string
          item_id: string
          merk: string | null
          tanggal: string
          toko_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          harga: number
          id?: string
          item_id: string
          merk?: string | null
          tanggal?: string
          toko_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          harga?: number
          id?: string
          item_id?: string
          merk?: string | null
          tanggal?: string
          toko_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "histori_harga_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "histori_harga_toko_id_fkey"
            columns: ["toko_id"]
            isOneToOne: false
            referencedRelation: "toko"
            referencedColumns: ["id"]
          },
        ]
      }
      item: {
        Row: {
          created_at: string
          id: string
          kategori_barang_id: string | null
          nama: string
          satuan_default: string
        }
        Insert: {
          created_at?: string
          id?: string
          kategori_barang_id?: string | null
          nama: string
          satuan_default?: string
        }
        Update: {
          created_at?: string
          id?: string
          kategori_barang_id?: string | null
          nama?: string
          satuan_default?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_kategori_barang_id_fkey"
            columns: ["kategori_barang_id"]
            isOneToOne: false
            referencedRelation: "kategori_barang"
            referencedColumns: ["id"]
          },
        ]
      }
      item_favorit: {
        Row: {
          created_at: string
          id: string
          item_id: string
          jumlah_default: number
          satuan_default: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          jumlah_default?: number
          satuan_default?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          jumlah_default?: number
          satuan_default?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_favorit_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item"
            referencedColumns: ["id"]
          },
        ]
      }
      kategori_barang: {
        Row: {
          created_at: string
          id: string
          nama: string
        }
        Insert: {
          created_at?: string
          id?: string
          nama: string
        }
        Update: {
          created_at?: string
          id?: string
          nama?: string
        }
        Relationships: []
      }
      kategori_pengeluaran: {
        Row: {
          created_at: string
          id: string
          nama: string
          urutan: number
        }
        Insert: {
          created_at?: string
          id?: string
          nama: string
          urutan?: number
        }
        Update: {
          created_at?: string
          id?: string
          nama?: string
          urutan?: number
        }
        Relationships: []
      }
      pengeluaran_lain: {
        Row: {
          created_at: string
          deskripsi: string
          id: string
          kategori_pengeluaran_id: string | null
          metode_bayar: string | null
          nominal: number
          rutin_id: string | null
          tanggal: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deskripsi?: string
          id?: string
          kategori_pengeluaran_id?: string | null
          metode_bayar?: string | null
          nominal?: number
          rutin_id?: string | null
          tanggal?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deskripsi?: string
          id?: string
          kategori_pengeluaran_id?: string | null
          metode_bayar?: string | null
          nominal?: number
          rutin_id?: string | null
          tanggal?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pengeluaran_lain_kategori_pengeluaran_id_fkey"
            columns: ["kategori_pengeluaran_id"]
            isOneToOne: false
            referencedRelation: "kategori_pengeluaran"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pengeluaran_lain_rutin_id_fkey"
            columns: ["rutin_id"]
            isOneToOne: false
            referencedRelation: "pengeluaran_rutin"
            referencedColumns: ["id"]
          },
        ]
      }
      pengeluaran_rutin: {
        Row: {
          aktif: boolean
          created_at: string
          deskripsi: string
          id: string
          kategori_pengeluaran_id: string | null
          metode_bayar: string | null
          nominal: number
          tanggal_hari: number
          user_id: string
        }
        Insert: {
          aktif?: boolean
          created_at?: string
          deskripsi?: string
          id?: string
          kategori_pengeluaran_id?: string | null
          metode_bayar?: string | null
          nominal?: number
          tanggal_hari?: number
          user_id: string
        }
        Update: {
          aktif?: boolean
          created_at?: string
          deskripsi?: string
          id?: string
          kategori_pengeluaran_id?: string | null
          metode_bayar?: string | null
          nominal?: number
          tanggal_hari?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pengeluaran_rutin_kategori_pengeluaran_id_fkey"
            columns: ["kategori_pengeluaran_id"]
            isOneToOne: false
            referencedRelation: "kategori_pengeluaran"
            referencedColumns: ["id"]
          },
        ]
      }
      kategori_user: {
        Row: {
          created_at: string
          id: string
          nama: string
        }
        Insert: {
          created_at?: string
          id?: string
          nama: string
        }
        Update: {
          created_at?: string
          id?: string
          nama?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          foto_url: string | null
          id: string
          kategori_user_id: string | null
          nama: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          foto_url?: string | null
          id: string
          kategori_user_id?: string | null
          nama?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          foto_url?: string | null
          id?: string
          kategori_user_id?: string | null
          nama?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_kategori_user_id_fkey"
            columns: ["kategori_user_id"]
            isOneToOne: false
            referencedRelation: "kategori_user"
            referencedColumns: ["id"]
          },
        ]
      }
      satuan: {
        Row: {
          created_at: string
          id: string
          nama: string
        }
        Insert: {
          created_at?: string
          id?: string
          nama: string
        }
        Update: {
          created_at?: string
          id?: string
          nama?: string
        }
        Relationships: []
      }
      toko: {
        Row: {
          created_at: string
          id: string
          nama: string
          tipe: string
        }
        Insert: {
          created_at?: string
          id?: string
          nama: string
          tipe?: string
        }
        Update: {
          created_at?: string
          id?: string
          nama?: string
          tipe?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "customer" | "admin"
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
      app_role: ["customer", "admin"],
    },
  },
} as const
