import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Gamepad2, History, Trophy, Users, Eye } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  const features = [
    {
      title: "New Game",
      description: "Start a new game of French Dominoes.",
      href: "/new-game",
      icon: <Gamepad2 className="h-8 w-8 text-primary" />,
    },
    {
      title: "Game History",
      description: "Review past games and statistics.",
      href: "/history",
      icon: <History className="h-8 w-8 text-primary" />,
    },
    {
      title: "Tournaments",
      description: "Manage and track tournaments.",
      href: "/tournaments",
      icon: <Trophy className="h-8 w-8 text-primary" />,
    },
    {
      title: "Player Management",
      description: "Manage player names and profiles.",
      href: "/players",
      icon: <Users className="h-8 w-8 text-primary" />,
    },
     {
      title: "Collusion Detector",
      description: "Analyze game data for anomalies.",
      href: "/collusion-detector",
      icon: <Eye className="h-8 w-8 text-primary" />,
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center py-8 md:py-12">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl md:text-4xl font-bold text-primary">Welcome!</CardTitle>
          <CardDescription className="text-lg md:text-xl">
            Your ultimate companion for French Dominoes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature) => (
              <Link href={feature.href} key={feature.title} passHref>
                <Button
                  variant="outline"
                  className="w-full h-auto p-6 flex flex-col items-center justify-center text-center shadow-lg hover:shadow-xl transition-shadow duration-300 border-2 border-primary hover:bg-primary/10"
                >
                  <div className="mb-3 p-3 bg-primary/10 rounded-full">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-1 text-primary">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </Button>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
