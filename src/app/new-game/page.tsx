import NewGameForm from "@/components/game/NewGameForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NewGamePage() {
  return (
    <div className="max-w-2xl mx-auto py-8">
      <Link href="/" passHref>
        <Button variant="outline" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
        </Button>
      </Link>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary">Setup New Game</CardTitle>
          <CardDescription>Configure player details and game settings to start playing.</CardDescription>
        </CardHeader>
        <CardContent>
          <NewGameForm />
        </CardContent>
      </Card>
    </div>
  );
}
