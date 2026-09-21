import Container from "@/components/ui/Container";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export default function NotFound() {
  return (
    <Container size="md" className="py-24">
      <Card className="text-center">
        <h1 className="text-page-title font-bold text-text">Page not found</h1>
        <p className="mt-3 text-default text-text-muted">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button href="/">Go home</Button>
          <Button href="/packages" variant="outline">
            Browse packages
          </Button>
        </div>
      </Card>
    </Container>
  );
}