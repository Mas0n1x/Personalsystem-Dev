import { memo } from 'react';
import type { Permission } from '../../types';

interface PermissionSelectorProps {
  permissionsByCategory: Record<string, Permission[]>;
  selectedPermissions: string[];
  onToggle: (permissionId: string) => void;
}

function PermissionSelector({
  permissionsByCategory,
  selectedPermissions,
  onToggle,
}: PermissionSelectorProps) {
  return (
    <div className="space-y-4 p-4 bg-slate-700/50 rounded-lg">
      {Object.entries(permissionsByCategory).map(([category, perms]) => (
        <div key={category}>
          <p className="text-sm font-medium text-slate-300 mb-2 uppercase">
            {category}
          </p>
          <div className="flex flex-wrap gap-2">
            {perms.map((perm) => {
              const isSelected = selectedPermissions.includes(perm.id);
              return (
                <button
                  key={perm.id}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onToggle(perm.id);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    isSelected
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                  }`}
                >
                  {perm.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default memo(PermissionSelector);
