import Link from 'next/link';
import { LogoIcon } from '@/components/icons/LogoIcon'; // Assuming you'll create this

const Header: React.FC = () => {
  return (
    <header className="bg-primary text-primary-foreground shadow-md">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <LogoIcon className="h-8 w-8" />
          <h1 className="text-xl md:text-2xl font-semibold">
            French Domino Scoreboard
          </h1>
        </Link>
        {/* Navigation items can be added here */}
        {/* For example:
        <nav className="space-x-4">
          <Link href="/history" className="hover:text-accent transition-colors">History</Link>
          <Link href="/tournaments" className="hover:text-accent transition-colors">Tournaments</Link>
        </nav>
        */}
      </div>
    </header>
  );
};

export default Header;
