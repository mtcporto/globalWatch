"use client";

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react'; // Or another suitable icon
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function AppHeader() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Wanted List' },
    { href: '/age-progression', label: 'Age Progression' },
  ];

  return (
    <header className="bg-primary text-primary-foreground shadow-md">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <ShieldAlert className="h-8 w-8 text-accent" />
          <h1 className="text-xl font-bold font-headline">Global Watch</h1>
        </Link>
        <nav className="flex items-center gap-2">
          {navItems.map((item) => (
            <Button asChild variant={pathname === item.href ? 'secondary' : 'ghost'} key={item.href} className={cn(pathname === item.href ? "text-primary-foreground bg-primary/70 hover:bg-primary/60" : "hover:bg-primary/20")}>
              <Link href={item.href} >
                {item.label}
              </Link>
            </Button>
          ))}
        </nav>
      </div>
    </header>
  );
}
