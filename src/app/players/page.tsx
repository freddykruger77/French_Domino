import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Construction } from "lucide-react";
import Link from "next/link";

export default function PlayersPage() {
  return (
    <div className="max-w-4xl mx-auto py-8">
      <Link href="/" passHref>
        <Button variant="outline" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
        </Button>
      </Link>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary">Player Management</CardTitle>
          <CardDescription>Manage player names and view player-specific statistics.</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-12">
          <Construction className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-xl text-muted-foreground">This page is under construction.</p>
          <p className="text-sm text-muted-foreground mt-2">Player profiles and detailed stats are coming soon!</p>
        </CardContent>
      </Card>
    </div>
  );
}
