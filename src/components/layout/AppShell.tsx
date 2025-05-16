import type React from 'react';
import Header from './Header';

interface AppShellProps {
  children: React.ReactNode;
}

const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
        {children}
      </main>
      {/* Potential Footer */}
      {/* <footer className="bg-muted text-muted-foreground p-4 text-center">
        © {new Date().getFullYear()} French Domino Scoreboard
      </footer> */}
    </div>
  );
};

export default AppShell;
