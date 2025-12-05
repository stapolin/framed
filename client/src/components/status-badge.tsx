import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: string;
}

function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  const statusLower = status.toLowerCase();
  
  if (statusLower.includes("complet") || statusLower.includes("deliver")) {
    return "default";
  }
  
  if (statusLower.includes("process") || statusLower.includes("ship")) {
    return "secondary";
  }
  
  if (statusLower.includes("cancel") || statusLower.includes("refund") || statusLower.includes("fail")) {
    return "destructive";
  }
  
  return "outline";
}

function formatStatusLabel(status: string): string {
  return status
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const variant = getStatusVariant(status);
  const label = formatStatusLabel(status);
  
  return (
    <Badge variant={variant} data-testid={`badge-status-${status}`}>
      {label}
    </Badge>
  );
}
