import * as React from "react";
import { TFile } from "obsidian";
import ZenithAI from "../../../index";
import { sanitizeTag } from "../../../someUtils";
import { SkeletonLoader } from "./components/skeleton-loader";
import { motion, AnimatePresence } from "framer-motion";
import {
  ExistingFolderButton,
  NewFolderButton,
} from "./components/suggestion-buttons";
import { logger } from "../../../services/logger";
// Rename the button components for tags
const ExistingTagButton = ExistingFolderButton;
const NewTagButton = NewFolderButton;

interface SimilarTagsProps {
  plugin: ZenithAI;
  file: TFile | null;
  content: string;
  refreshKey: number;
  onTokenLimitError?: (error: string) => void;
}

export const SimilarTags: React.FC<SimilarTagsProps> = ({
  plugin,
  file,
  content,
  refreshKey,
  onTokenLimitError,
}) => {
  const [existingTags, setExistingTags] = React.useState<
    { tag: string; score: number; reason: string }[]
  >([]);
  const [newTags, setNewTags] = React.useState<
    { tag: string; score: number; reason: string }[]
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = React.useState(false);

  React.useEffect(() => {
    const fetchTags = async () => {
      if (!file || !content) return;
      setLoading(true);
      setExistingTags([]);
      setNewTags([]);

      try {
        const vaultTags = await plugin.getAllVaultTags();
        const suggestedTags = await plugin.recommendTags(
          content,
          file.basename,
          vaultTags
        );

        const existingTagsResult = suggestedTags
          .filter(tag => !tag.isNew)
          .map(tag => ({ tag: tag.tag, score: tag.score, reason: tag.reason }));
        const newTagsResult = suggestedTags
          .filter(tag => tag.isNew)
          .map(tag => ({ tag: tag.tag, score: tag.score, reason: tag.reason }));

        setExistingTags(existingTagsResult || []);
        setNewTags(newTagsResult || []);
      } catch (error) {
        logger.error("Error in tag fetching process:", error);

        // Check if this is a token limit error
        if (error && typeof error === 'object' && 'status' in error && (error as any).status === 429) {
          const errorMessage = (error as any).message || "Token limit exceeded. Please upgrade your plan for more tokens.";
          // Notify parent component to show upgrade button
          onTokenLimitError?.(errorMessage);
        }
      } finally {
        setLoading(false);
        setInitialLoadComplete(true);
      }
    };
    fetchTags();
  }, [file, content, refreshKey, plugin, onTokenLimitError]);

  const handleTagClick = (tag: string) => {
    plugin.appendTag(file!, tag);
  };

  const renderContent = () => {
    if (loading) {
      return <SkeletonLoader count={4} width="60px" height="24px" rows={1} />;
    }
    if (
      initialLoadComplete &&
      existingTags.length === 0 &&
      newTags.length === 0
    ) {
      return <div className="text-[#7aa2f7] p-2">No tags found</div>;
    }

    return (
      <motion.div
        className="flex flex-wrap gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <AnimatePresence>
          {existingTags.map((tag, index) => (
            <ExistingTagButton
              key={`existing-${index}`}
              folder={sanitizeTag(tag.tag)}
              onClick={handleTagClick}
              score={tag.score}
              reason={tag.reason}
            />
          ))}
          {newTags.map((tag, index) => (
            <NewTagButton
              key={`new-${index}`}
              folder={sanitizeTag(tag.tag)}
              onClick={handleTagClick}
              score={tag.score}
              reason={tag.reason}
            />
          ))}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <div className="bg-[#191621] text-[#bebebe] p-4 border-b border-[rgba(14,210,247,0.05)] rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.4)] hover:border-[rgba(14,210,247,0.1)] transition-colors duration-200">
      {renderContent()}
    </div>
  );
};
