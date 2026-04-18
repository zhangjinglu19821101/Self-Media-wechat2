import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/full-home?tab=tasks');
}
