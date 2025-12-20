
import React from 'react';
import { CheckCircle, Circle, AlertCircle, Loader2 } from 'lucide-react';
import { NodeStatus } from '../types';

interface StatusIconProps {
  status: NodeStatus;
  size?: number;
}

export const StatusIcon: React.FC<StatusIconProps> = ({ status, size = 20 }) => {
  switch (status) {
    case NodeStatus.COMPLETED:
      return <CheckCircle size={size} className="text-emerald-500 fill-emerald-50" />;
    case NodeStatus.PROCESSING:
      return <Loader2 size={size} className="text-blue-500 animate-spin" />;
    case NodeStatus.FAILED:
      return <AlertCircle size={size} className="text-rose-500" />;
    case NodeStatus.PENDING:
      return <Circle size={size} className="text-slate-300" />;
    default:
      return null;
  }
};
