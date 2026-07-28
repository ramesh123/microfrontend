import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { FlowNameOnlyForm } from '../FlowNameOnlyForm';

export function CreateWorkflow() {
  const [searchParams] = useSearchParams();
  const isVirtualDb = searchParams.get('virtualdb') === '1';

  return (
    <div className="container mx-auto flex flex-col px-2 py-2 md:px-2">
      <div className="w-full max-w-[99vw] mx-auto">
        <div className="mb-4 flex items-center">
          <Button variant="ghost" size="icon" asChild>
            <Link to={isVirtualDb ? '/virtual-db' : '/workflows'}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="ml-2 text-xl font-bold">
            {isVirtualDb ? 'Create a Virtual DB' : 'Create a Workflow'}
          </h1>
        </div>

        <Card className="w-full">
          <CardHeader>
            <CardDescription>
              {isVirtualDb
                ? 'Enter a name for your Virtual DB to get started. The Virtual DB option is checked so this workflow will open in Virtual DB mode.'
                : 'Enter a name for your workflow to get started. You can add more details when saving.'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <FlowNameOnlyForm
              defaultVirtualDb={isVirtualDb}
              submitButtonLabel={isVirtualDb ? 'Create Virtual DB' : 'Create Workflow'}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
