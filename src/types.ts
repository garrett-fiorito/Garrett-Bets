export type BetCategory = 'active' | 'future';
export type BetStatus = 'pending' | 'won' | 'lost' | 'push' | 'void';

export type BetLeg = {
  id: string;
  bet_id: string;
  description: string;
  odds: number;
  position: number;
  created_at: string;
};

export type Bet = {
  id: string;
  user_id: string;
  category: BetCategory;
  status: BetStatus;
  stake: number;
  display_order: number;
  placed_at: string;
  sportsbook: string;
  created_at: string;
  updated_at: string;
  settled_at: string | null;
  legs: BetLeg[];
};

export type BetDraft = {
  id?: string;
  category: BetCategory;
  status: BetStatus;
  stake: string;
  placed_at: string;
  sportsbook: string;
  legs: Array<{
    id?: string;
    description: string;
    odds: string;
  }>;
};

export type Database = {
  public: {
    Tables: {
      bets: {
        Row: {
          id: string;
          user_id: string;
          category: BetCategory;
          status: BetStatus;
          stake: number;
          display_order: number;
          placed_at: string;
          sportsbook: string;
          created_at: string;
          updated_at: string;
          settled_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          category: BetCategory;
          status?: BetStatus;
          stake: number;
          display_order?: number;
          placed_at?: string;
          sportsbook?: string;
          settled_at?: string | null;
        };
        Update: {
          category?: BetCategory;
          status?: BetStatus;
          stake?: number;
          display_order?: number;
          placed_at?: string;
          sportsbook?: string;
          settled_at?: string | null;
        };
        Relationships: [];
      };
      bet_legs: {
        Row: BetLeg;
        Insert: {
          id?: string;
          bet_id: string;
          description: string;
          odds: number;
          position: number;
        };
        Update: {
          description?: string;
          odds?: number;
          position?: number;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
