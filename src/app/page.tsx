import { AppHeader } from '@/widgets/AppHeader';
import { WorkArea } from '@/widgets/WorkArea';

export default function HomePage() {
  return (
    <div className="h-dvh bg-[#101114] flex flex-col">
      <AppHeader />
      <WorkArea />
    </div>
  );
}
