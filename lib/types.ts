export type Team = 'orange' | 'black';

export interface WeeklyMember {
  name: string;
  pts: number;
  team: Team;
}

export interface TeamBlock {
  total: number;
  g3: number;
  steps: number;
  cals: number;
  weekly: number;
  activeMembers: number;
  members: WeeklyMember[];
}

export interface ScoreboardData {
  orange: TeamBlock;
  black: TeamBlock;
  weeklyMembers: WeeklyMember[];
  weekLabel: string;
  lastUpdated: string;
}
