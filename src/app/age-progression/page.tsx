import { AgeProgressionClient } from '@/components/AgeProgressionClient';

export const metadata = {
  title: 'Age Progression Tool | Global Watch',
  description: 'Use AI to generate an age-progressed photo of a person.',
};

export default function AgeProgressionPage() {
  return (
    <div>
      <AgeProgressionClient />
    </div>
  );
}
