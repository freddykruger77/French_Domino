
import NewTournamentForm from "@/components/tournament/NewTournamentForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NewTournamentPage() {
  return (
    <div className="max-w-2xl mx-auto py-8">
      <Link href="/tournaments" passHref>
        <Button variant="outline" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Tournaments
        </Button>
      </Link>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary">Create New Tournament</CardTitle>
          <CardDescription>Set up the details for your new tournament.</CardDescription>
        </CardHeader>
        <CardContent>
          <NewTournamentForm />
        </CardContent>
      </Card>
    </div>
  );
}
