
import Scoreboard from "@/components/game/Scoreboard";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react"; // Added 'use'

interface GamePageProps {
  params: {
    id: string;
  };
}

export default function GamePage({ params }: GamePageProps) {
  const resolvedParams = use(params);
  const { id: gameId } = resolvedParams;

  return (
    <div className="w-full">
      <Link href="/" passHref>
        <Button variant="outline" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
        </Button>
      </Link>
      <Scoreboard gameId={gameId} />
    </div>
  );
}
