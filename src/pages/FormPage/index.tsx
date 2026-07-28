import React from 'react';
import DynamicForm from '@/components/core/dynamicForm';
import { toast } from 'sonner';

const FormPage: React.FC = () => { 
  const formFields = [ 
    {
      name: "firstName",
      type: 'text' as const,
      displayName: "First Name",
      placeholder: "Enter your first name",
      required: true,
      info: "Your legal first name as it appears on your ID"
    },
    {
      name: "lastName",
      type: 'text' as const,
      displayName: "Last Name",
      placeholder: "Enter your last name",
      required: true
    },
    {
      name: "email",
      type: 'text' as const,
      displayName: "Email Address",
      placeholder: "your.email@example.com",
      required: true,
      info: "We'll never share your email with anyone else"
    },
    {
      name: "age",
      type: 'number' as const,
      displayName: "Age",
      placeholder: "Enter your age",
      required: true,
      min: 18,
      max: 120,
      info: "You must be at least 18 years old"
    },
    {
      name: "password",
      type: 'password' as const,
      displayName: "Password",
      placeholder: "Create a password",
      required: true,
      info: "Must be at least 8 characters with a number and special character"
    },
    {
      name: "country",
      type: 'dropdown' as const,
      displayName: "Country",
      placeholder: "Select your country",
      required: true,
      options: [
        { value: "us", label: "United States" },
        { value: "ca", label: "Canada" },
        { value: "uk", label: "United Kingdom" },
        { value: "au", label: "Australia" }
      ]
    },
    {
      name: "dependencies",
      type: 'number' as const,
      displayName: "Number of Dependents",
      placeholder: "Enter number",
      required: false,
      min: 0,
      max: 10,
      step: 1,
      info: "Number of people who depend on you financially"
    },
    {
      name: "interests",
      type: 'multiDropdown' as const,
      displayName: "Interests",
      placeholder: "Select your interests",
      info: "Choose all that apply",
      options: [
        { value: "tech", label: "Technology" },
        { value: "sports", label: "Sports" },
        { value: "music", label: "Music" },
        { value: "art", label: "Art" },
        { value: "travel", label: "Travel" }
      ]
    },
    {
      name: "bio", 
      type: 'textArea' as const,
      displayName: "Bio",
      placeholder: "Tell us about yourself",
      info: "Brief description about yourself (max 200 words)"
    },
    {
      name: "newsletter",
      type: 'checkbox' as const,
      displayName: "Subscribe to newsletter",
      info: "Get weekly updates and news"
    },
    {
      name: "termsAndConditions",
      type: 'checkbox' as const,
      displayName: "I agree to the Terms and Conditions",
      required: true
    }
  ];

  const handleSubmit = (formData: Record<string, any>) => {
    console.log("Form submitted:", formData);
    // Here you would typically send the data to an API
    toast.error("Form submitted successfully!");
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 min-h-screen py-12">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-6 sm:p-10">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">User Registration</h1>
            <p className="text-gray-600 mb-8">Please fill out the form below to create your account.</p>
            
            {/* <DynamicForm 
              formSchema={formFields} 
              onSubmit={handleSubmit}
              onCancel={() => {}}
              title=""
            /> */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormPage;