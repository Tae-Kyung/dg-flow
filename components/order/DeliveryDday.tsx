import { Badge } from '@/components/ui/badge';

export default function DeliveryDday({ date }: { date: string }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const delivery = new Date(date);
  delivery.setHours(0, 0, 0, 0);
  const diff = Math.ceil((delivery.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  let ddayText: string;
  let ddayClass: string;

  if (diff < 0) {
    ddayText = `D+${Math.abs(diff)}`;
    ddayClass = 'bg-rose-100 text-rose-700 border-rose-200';
  } else if (diff === 0) {
    ddayText = 'D-Day';
    ddayClass = 'bg-rose-100 text-rose-700 border-rose-200';
  } else if (diff <= 3) {
    ddayText = `D-${diff}`;
    ddayClass = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (diff <= 7) {
    ddayText = `D-${diff}`;
    ddayClass = 'bg-blue-50 text-blue-700 border-blue-200';
  } else {
    return <span className="text-sm">{date}</span>;
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm">{date}</span>
      <Badge className={`${ddayClass} border rounded-full px-1.5 py-0 text-[10px] font-semibold`} variant="secondary">
        {ddayText}
      </Badge>
    </div>
  );
}
