export type BetCategory = 'active' | 'future';
export type BetStatus = 'pending' | 'won' | 'lost' | 'push' | 'void';
export type FriendshipStatus = 'pending' | 'accepted';

export type BetLeg = {
  id: string;
  bet_id: string;
  description: string;
  odds: number;
  position: number;
  is_complete: boolean;
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
    is_complete?: boolean;
  }>;
};

export type Profile = {
  user_id: string;
  display_name: string;
  friend_code: string;
  created_at: string;
  updated_at: string;
};

export type Friendship = {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
};

export type FriendConnection = Friendship & {
  friend: Profile;
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
          is_complete?: boolean;
        };
        Update: {
          description?: string;
          odds?: number;
          position?: number;
          is_complete?: boolean;
        };
        Relationships: [];
      };
      profiles: {
        Row: Profile;
        Insert: {
          user_id: string;
          display_name?: string;
          friend_code?: string;
        };
        Update: {
          display_name?: string;
          friend_code?: string;
        };
        Relationships: [];
      };
      friendships: {
        Row: Friendship;
        Insert: {
          id?: string;
          requester_id: string;
          recipient_id: string;
          status?: FriendshipStatus;
        };
        Update: {
          status?: FriendshipStatus;
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
