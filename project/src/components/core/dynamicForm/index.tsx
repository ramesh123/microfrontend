import React, { useState } from 'react';
import InputPassword from '../inputPassword';
import InputDropdown from '../inputDropdown';
import InputMultiDropdown from '../inputMultiDropdown';
import InputTextArea from '../inputTextArea';
import InputCheckbox from '../inputCheckbox';
import InputNumber from '../inputNumber';
import InputText from '../inputText';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface FormField {
    name: string;
    type: 'text' | 'password' | 'dropdown' | 'multiDropdown' | 'textArea' | 'checkbox' | 'number';
    displayName: string;
    placeholder?: string;
    required?: boolean;
    info?: string;
    options?: Array<{ value: string; label: string }>;
    min?: number;
    max?: number;
    step?: number;
  }
  
  interface DynamicFormProps {
    formFields: FormField[];
    onSubmit: (formData: Record<string, any>) => void;
    title?: string;
  }
  
  const DynamicForm: React.FC<DynamicFormProps> = ({
    formFields,
    onSubmit,
    title = "Form"
  }) => {
    const initialFormData = formFields.reduce((acc, field) => {
      if (field.type === 'checkbox') {
        acc[field.name] = false;
      } else if (field.type === 'multiDropdown') {
        acc[field.name] = [];
      } else {
        acc[field.name] = '';
      }
      return acc;
    }, {} as Record<string, any>);
  
    const [formData, setFormData] = useState(initialFormData);
    
    const handleInputChange = (name: string, value: any) => {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    };
  
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(formData);
    };
  
    // Group fields for the layout
    const groupFields = (fields: FormField[], fieldsPerRow: number) => {
      // Special handling for textArea and multiDropdown components - they get their own row
      const rows: FormField[][] = [];
      let currentRow: FormField[] = [];
      
      fields.forEach(field => {  
        // Fields that should take full width or special placement
        if (field.type === 'textArea' || field.type === 'multiDropdown') {
          // If there are fields in the current row, add them first
          if (currentRow.length > 0) {
            rows.push([...currentRow]);
            currentRow = [];
          }
          // Add the full-width field as its own row
          rows.push([field]);
        } else {
          // Add to current row
          currentRow.push(field);
          // If row is full, push it and start a new one
          if (currentRow.length === fieldsPerRow) {  
            rows.push([...currentRow]);
            currentRow = [];
          }
        }
      });
      
      // Add any remaining fields
     
      if (currentRow.length > 0) {
        rows.push([...currentRow]);
      }
      
      return rows;
    };
  
    const renderFormField = (field: FormField, index: number) => {
      const { name, type, displayName, placeholder, required, info } = field;
      
      switch (type) {
        case 'text':
          return ( 
            <InputText
              key={index}
              name={name}
              displayName={displayName}
              placeholder={placeholder}
              required={required}
              info={info}
              value={formData[name] as string}
              onChange={(e) => handleInputChange(name, e.target.value)}
            />
          );
          case 'password':
            return (
              <InputPassword
                id={name}
                key={index}
                name={name}
                displayName={displayName}
                placeholder={placeholder}
                required={required}
                info={info}
                value={formData[name] as string}
                onChange={(e) => handleInputChange(name, e.target.value)}
              />
            );
          case 'dropdown':
          return (
            <InputDropdown
              key={index}
              name={name}
              displayName={displayName}
              placeholder={placeholder}
              required={required}
              info={info}
              options={field.options || []}
              value={formData[name] as string}
              onChange={(value) => handleInputChange(name, value)}
            />
          );
        case 'multiDropdown':
          return (
            <InputMultiDropdown
              key={index}
              name={name}
              displayName={displayName}
              placeholder={placeholder}
              required={required}
              info={info}
              options={field.options || []}
              value={formData[name] as string[]}
              onChange={(value) => handleInputChange(name, value)}
            />
          );
        case 'textArea':
          return (
            <InputTextArea
              key={index}
              name={name}
              displayName={displayName}
              placeholder={placeholder}
              required={required}
              info={info}
              value={formData[name] as string}
              onChange={(e) => handleInputChange(name, e.target.value)}
            />
          );
        case 'checkbox':
          return (
            <InputCheckbox
              key={index}
              name={name}
              displayName={displayName}
              required={required}
              info={info}
              checked={formData[name] as boolean}
              onChange={(checked) => handleInputChange(name, checked)}
            />
          );
        case 'number':
          return (
            <InputNumber
              key={index}
              name={name}
              displayName={displayName}
              placeholder={placeholder}
              required={required}
              info={info}
              value={formData[name] as number | string}
              min={field.min}
              max={field.max}
              step={field.step}
              onChange={(e) => handleInputChange(name, e.target.value)}
            />
          );
        default:
          return null;
      }
    };
  
    // Group fields for better layout (2-3 per row)
    const fieldRows = groupFields(formFields, 3);
  
    return (
      <Card className="w-full shadow-md border-0">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit}>
            {title && <h2 className="text-2xl font-bold mb-6">{title}</h2>}
            
            {fieldRows.map((row, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                {row.map((field, fieldIndex) => (
                  <div 
                    key={`${rowIndex}-${fieldIndex}`}
                    className={`
                      ${field.type === 'textArea' || field.type === 'multiDropdown' ? 'col-span-1 md:col-span-2 lg:col-span-3' : ''}
                      ${field.type === 'checkbox' ? 'flex items-center' : ''}
                    `}
                  >
                    {renderFormField(field, fieldIndex)}
                  </div>
                ))}
              </div>
            ))}
            
            <div className="mt-8 flex justify-end">
              <Button type="submit" >
                Submit
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );

  };

  export default DynamicForm;