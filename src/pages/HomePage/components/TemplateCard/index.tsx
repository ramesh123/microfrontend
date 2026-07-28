import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Layers, ArrowRight } from 'lucide-react';
import { Template } from '@/types';

interface TemplateCardProps {
  template: Template;
  onUseTemplate: () => void;
}

export default function TemplateCard({ template, onUseTemplate }: TemplateCardProps) {
  return (
    <Card className="hover:shadow-lg hover:border-primary transition-all duration-300 flex flex-col group">
      <CardHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-muted rounded-lg">
            <Layers className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-base text-gray-900 truncate group-hover:text-primary">
              {template.name}
            </h3>
            <p className="text-xs text-gray-500">
              {template.category}
            </p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 pt-0 flex-grow flex flex-col justify-between">
        <div>
          <p className="text-sm text-gray-600 leading-relaxed line-clamp-2 mb-3">
            {template.description}
          </p>
          <div className="flex flex-wrap gap-1">
            {template.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
        <Button size="sm" className="w-full mt-4" onClick={onUseTemplate}>
          Use Template
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}
