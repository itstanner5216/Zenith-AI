'use client';

import * as React from 'react';
import {
  FileText,
  Upload,
  Files,
  Image,
  FileSymlink,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function DashboardPage() {
  const [recentFiles, setRecentFiles] = React.useState<
    Array<{
      id: number;
      name: string;
      type: string;
      date: string;
      path: string;
    }>
  >([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch data on component mount
  React.useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch recent files
        const filesResponse = await fetch('/api/files/recent');
        if (!filesResponse.ok) {
          throw new Error('Failed to fetch recent files');
        }
        const filesData = await filesResponse.json();
        setRecentFiles(filesData);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError(
          err instanceof Error ? err.message : 'An unknown error occurred'
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Helper to get icon based on file type
  const getFileIcon = (type: string) => {
    switch (type) {
      case 'markdown':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'image':
        return <Image className="h-4 w-4 text-purple-500" />;
      default:
        return <FileSymlink className="h-4 w-4 text-gray-500" />;
    }
  };

  // Format date in a readable way
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  // Handle file upload
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload files');
      }

      // Refresh the recent files list
      const filesResponse = await fetch('/api/files/recent');
      if (!filesResponse.ok) {
        throw new Error('Failed to fetch recent files');
      }
      const filesData = await filesResponse.json();
      setRecentFiles(filesData);
    } catch (err) {
      console.error('Error uploading files:', err);
      setError(
        err instanceof Error ? err.message : 'An unknown error occurred'
      );
    }
  };

  return (
    <div className="flex-1 space-y-6 p-6 pt-6 bg-white">
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-muted-foreground">
            Welcome to Zenith-AI - your centralized note management hub.
          </p>
        </div>
      </div>

      {/* Recent Files Card */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Recent Synced Files</CardTitle>
          <CardDescription>
            Your most recently synced files from the Zenith-AI database
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              <p className="text-sm font-medium">Failed to load recent files</p>
              <p className="text-xs mt-1">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : recentFiles.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Files className="h-12 w-12 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium">No files synced yet</p>
              <p className="text-xs mt-1">Upload files to see them here</p>
              <div className="mt-4">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Button variant="outline" size="sm" className="mx-auto">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Files
                  </Button>
                  <input
                    id="file-upload"
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {recentFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-md"
                >
                  <div className="flex items-center gap-2">
                    {getFileIcon(file.type)}
                    <div>
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {file.path}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">{formatDate(file.date)}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
