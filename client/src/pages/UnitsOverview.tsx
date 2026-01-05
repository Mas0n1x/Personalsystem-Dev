import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { unitsApi } from '../services/api';
import {
  Users,
  Shield,
  ChevronDown,
  ChevronRight,
  Crown,
  RefreshCw,
  Star,
  User,
  Crosshair,
  Scale,
  GraduationCap,
  Search,
  UserCheck,
  Bike,
  Settings,
  PartyPopper,
  Car,
  BadgeCheck,
  type LucideIcon,
} from 'lucide-react';

// Icon Mapping fuer Units basierend auf Name/ShortName
const unitIconMap: Record<string, LucideIcon> = {
  'SWAT': Crosshair,
  'Special Weapons & Tactics': Crosshair,
  'IA': Scale,
  'Internal Affairs': Scale,
  'PA': GraduationCap,
  'Police Academy': GraduationCap,
  'DET': Search,
  'Detectives': Search,
  'HR': UserCheck,
  'Human Ressource': UserCheck,
  'Biker': Bike,
  'MGMT': Settings,
  'Management': Settings,
  'ET': PartyPopper,
  'Eventteam': PartyPopper,
  'SHP': Car,
  'State & Highway Patrol': Car,
  'QA': BadgeCheck,
  'Quality Assurance': BadgeCheck,
  'TL': Crown,
  'Teamleitung': Crown,
};

function getUnitIcon(unit: { name: string; shortName: string | null }): LucideIcon {
  // Zuerst nach ShortName suchen
  if (unit.shortName && unitIconMap[unit.shortName]) {
    return unitIconMap[unit.shortName];
  }
  // Dann nach Name suchen
  if (unitIconMap[unit.name]) {
    return unitIconMap[unit.name];
  }
  // Default: Shield
  return Shield;
}

interface UnitRole {
  id: string;
  discordRoleId: string;
  discordRoleName: string;
  position: string;
  sortOrder: number;
  isLeadership: boolean;
}

interface Unit {
  id: string;
  name: string;
  shortName: string | null;
  description: string | null;
  color: string;
  icon: string | null;
  isActive: boolean;
  sortOrder: number;
  roles: UnitRole[];
  memberCount?: number;
  leadershipCount?: number;
}

interface UnitMember {
  id: string;
  name: string;
  avatar: string | null;
  rank: string;
  badgeNumber: string;
  unitPosition: string;
  isLeadership: boolean;
  sortOrder: number;
}

export default function UnitsOverview() {
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);

  // Units mit Member-Counts laden
  const { data: unitsData, isLoading: unitsLoading, refetch } = useQuery({
    queryKey: ['units-overview'],
    queryFn: async () => {
      const res = await unitsApi.getOverview();
      return res.data as Unit[];
    },
  });

  // Members für expanded Unit laden
  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['unit-members', expandedUnit],
    queryFn: async () => {
      if (!expandedUnit) return null;
      const res = await unitsApi.getMembers(expandedUnit);
      return res.data as { unit: Unit; members: UnitMember[] };
    },
    enabled: !!expandedUnit,
  });

  const units = unitsData || [];

  const toggleUnit = (unitId: string) => {
    setExpandedUnit((prev) => (prev === unitId ? null : unitId));
  };

  const getAvatarUrl = (discordId: string, avatar: string | null) => {
    if (!avatar) return null;
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png`;
  };

  if (unitsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Units-Übersicht</h1>
          <p className="text-slate-400 mt-1">Alle Units und ihre Mitglieder</p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Aktualisieren
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 bg-gradient-to-br from-indigo-900/20 to-slate-800/50 border-indigo-700/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/20 rounded-lg">
              <Shield className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-indigo-400">{units.length}</p>
              <p className="text-xs text-slate-400">Units</p>
            </div>
          </div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-blue-900/20 to-slate-800/50 border-blue-700/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-lg">
              <Users className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-blue-400">
                {units.reduce((sum, u) => sum + (u.memberCount || 0), 0)}
              </p>
              <p className="text-xs text-slate-400">Mitglieder Gesamt</p>
            </div>
          </div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-amber-900/20 to-slate-800/50 border-amber-700/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-600/20 rounded-lg">
              <Crown className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-amber-400">
                {units.reduce((sum, u) => sum + (u.leadershipCount || 0), 0)}
              </p>
              <p className="text-xs text-slate-400">Leitungspositionen</p>
            </div>
          </div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-green-900/20 to-slate-800/50 border-green-700/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-600/20 rounded-lg">
              <Star className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-green-400">
                {units.filter((u) => (u.memberCount || 0) > 0).length}
              </p>
              <p className="text-xs text-slate-400">Aktive Units</p>
            </div>
          </div>
        </div>
      </div>

      {/* Units List */}
      <div className="space-y-4">
        {units.length === 0 ? (
          <div className="card p-12 text-center">
            <Shield className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">Keine Units vorhanden</p>
            <p className="text-sm text-slate-500 mt-1">
              Units können in der Administration erstellt werden.
            </p>
          </div>
        ) : (
          units.map((unit) => (
            <div key={unit.id} className="card overflow-hidden">
              {/* Unit Header */}
              <button
                onClick={() => toggleUnit(unit.id)}
                className="w-full p-4 flex items-center gap-4 hover:bg-slate-750 transition-colors text-left"
                style={{
                  borderLeft: `4px solid ${unit.color}`,
                }}
              >
                {(() => {
                  const UnitIcon = getUnitIcon(unit);
                  return (
                    <div
                      className="p-3 rounded-xl"
                      style={{ backgroundColor: `${unit.color}20` }}
                    >
                      <UnitIcon className="h-6 w-6" style={{ color: unit.color }} />
                    </div>
                  );
                })()}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">{unit.name}</h3>
                    {unit.shortName && (
                      <span className="px-2 py-0.5 text-xs bg-slate-600/50 text-slate-300 rounded">
                        {unit.shortName}
                      </span>
                    )}
                  </div>
                  {unit.description && (
                    <p className="text-sm text-slate-400 truncate mt-0.5">
                      {unit.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-lg font-bold text-white">{unit.memberCount || 0}</p>
                    <p className="text-xs text-slate-400">Mitglieder</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-amber-400">{unit.leadershipCount || 0}</p>
                    <p className="text-xs text-slate-400">Leitung</p>
                  </div>
                  <div className="p-2">
                    {expandedUnit === unit.id ? (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                </div>
              </button>

              {/* Unit Members */}
              {expandedUnit === unit.id && (
                <div className="border-t border-slate-700">
                  {membersLoading ? (
                    <div className="p-8 text-center">
                      <RefreshCw className="h-6 w-6 text-slate-400 animate-spin mx-auto" />
                    </div>
                  ) : membersData?.members.length === 0 ? (
                    <div className="p-8 text-center">
                      <Users className="h-10 w-10 text-slate-600 mx-auto mb-2" />
                      <p className="text-slate-400">Keine Mitglieder in dieser Unit</p>
                    </div>
                  ) : (
                    <div className="p-4">
                      {/* Leadership Section */}
                      {membersData?.members.some((m) => m.isLeadership) && (
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-amber-400 mb-3 flex items-center gap-2">
                            <Crown className="h-4 w-4" />
                            Leitung
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {membersData?.members
                              .filter((m) => m.isLeadership)
                              .map((member) => (
                                <div
                                  key={member.id}
                                  className="flex items-center gap-3 p-3 bg-amber-900/10 border border-amber-700/30 rounded-lg"
                                >
                                  {member.avatar ? (
                                    <img
                                      src={getAvatarUrl(member.id, member.avatar) || ''}
                                      alt={member.name}
                                      className="w-10 h-10 rounded-full"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center">
                                      <User className="h-5 w-5 text-slate-400" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-white truncate">{member.name}</p>
                                    <p className="text-xs text-amber-400">{member.unitPosition}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs text-slate-400">{member.rank}</p>
                                    <p className="text-xs text-slate-500">#{member.badgeNumber}</p>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Members Section */}
                      {membersData?.members.some((m) => !m.isLeadership) && (
                        <div>
                          <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Mitglieder
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {membersData?.members
                              .filter((m) => !m.isLeadership)
                              .map((member) => (
                                <div
                                  key={member.id}
                                  className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg"
                                >
                                  {member.avatar ? (
                                    <img
                                      src={getAvatarUrl(member.id, member.avatar) || ''}
                                      alt={member.name}
                                      className="w-10 h-10 rounded-full"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center">
                                      <User className="h-5 w-5 text-slate-400" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-white truncate">{member.name}</p>
                                    <p className="text-xs text-slate-400">{member.unitPosition}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs text-slate-400">{member.rank}</p>
                                    <p className="text-xs text-slate-500">#{member.badgeNumber}</p>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
