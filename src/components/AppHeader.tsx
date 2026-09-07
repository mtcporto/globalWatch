"use client";

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
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
    <header className="sticky top-0 z-40 border-b border-primary-foreground/10 bg-primary/95 text-primary-foreground shadow-md backdrop-blur">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <ShieldAlert className="h-8 w-8 text-accent" />
          <div>
            <h1 className="font-headline text-xl font-bold leading-none">Global Watch</h1>
            <p className="mt-1 hidden text-[10px] uppercase tracking-[0.18em] text-primary-foreground/60 sm:block">Public records, made clear</p>
          </div>
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
