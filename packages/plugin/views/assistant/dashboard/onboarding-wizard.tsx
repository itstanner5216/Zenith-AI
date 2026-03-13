import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "../../../components/ui/button";
import ZenithAI from "../../../index";
import { Notice } from "obsidian";
import { StyledContainer } from "../../../components/ui/utils";
import { tw } from "../../../lib/utils";

interface OnboardingWizardProps {
  plugin: ZenithAI;
  onComplete: () => void;
}

export function OnboardingWizard({ plugin, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSignup, setIsSignup] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignup = async () => {
    if (isSignup && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const endpoint = isSignup ? "/api/sign-up" : "/api/sign-in";
      const response = await fetch(`${plugin.getServerUrl()}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      
      if (!data.success || !data.licenseKey) {
        setError(data.error || "Authentication failed");
        setIsLoading(false);
        return;
      }

      // Set the license key
      plugin.settings.API_KEY = data.licenseKey;
      await plugin.saveSettings();
      
      // Show success message
      new Notice(`Successfully ${isSignup ? "signed up" : "signed in"}! Your account is now connected.`, 5000);
      
      // Move to next step
      nextStep();
    } catch (error) {
      console.error(`Error during ${isSignup ? "signup" : "login"}:`, error);
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const nextStep = () => setStep(step + 1);

  const finish = async () => {
    // Create necessary folders
    await plugin.checkAndCreateRequiredFolders();
    
    // Mark onboarding as complete
    plugin.settings.hasRunOnboarding = true;
    await plugin.saveSettings();
    
    onComplete();
  };

  const skipAccount = () => {
    nextStep();
  };

  return (
    <StyledContainer>
      <motion.div
        className={tw("max-w-xl mx-auto bg-[var(--bg-depth-3)] p-6 rounded-xl border border-[rgba(14,210,247,0.12)] shadow-[0_8px_40px_rgba(0,0,0,0.7),0_0_16px_rgba(14,210,247,0.08)]")}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <h2 className={tw("text-xl font-bold mb-6 bg-gradient-to-r from-[var(--gradient-blue)] to-[var(--gradient-lavender)] bg-clip-text text-transparent")}>
          {step === 0
            ? "Welcome to Zenith-AI!"
            : step === 1
            ? "Create Your Account"
            : "Set Up Your Workspace"}
        </h2>

        {step === 0 && (
          <div className={tw("mb-6 space-y-4")}>
            <p className={tw("text-[var(--text-normal)]")}>
              Zenith-AI helps you organize your Obsidian vault with AI-powered features:
            </p>
            <ul className={tw("space-y-2")}>
              {[
                "Automatically organize and format notes",
                "Extract key concepts and suggest tags",
                "Get AI assistance with your content",
                "Sync across devices"
              ].map((item, i) => (
                <li key={i} className={tw("flex items-start gap-2 text-[var(--text-normal)]")}>  
                  <span className={tw("w-1.5 h-1.5 rounded-full bg-[var(--text-accent)] shadow-[0_0_4px_rgba(14,210,247,0.5)] mt-1.5 flex-shrink-0")} />
                  {item}
                </li>
              ))}
            </ul>
            <p className={tw("text-sm text-[var(--text-dim)] mt-4")}>
              Let's get you set up in just a few steps!
            </p>
            <Button
              onClick={nextStep}
              className={tw("w-full mt-4")}
            >
              Get Started
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className={tw("mb-6 space-y-4")}>
            <div className={tw("mb-4 flex items-center justify-center space-x-4")}>
          <div
              className={tw(`cursor-pointer px-4 py-2 text-sm font-semibold transition-all duration-150 ${
                isSignup 
                  ? "text-[var(--text-accent)] border-b-2 border-[var(--text-accent)] drop-shadow-[0_0_4px_rgba(14,210,247,0.3)]" 
                  : "text-[var(--text-dim)] opacity-70 hover:opacity-100 border-b-2 border-transparent"
              }`)}
              onClick={() => setIsSignup(true)}
            >
              Sign Up
            </div>
            <div
              className={tw(`cursor-pointer px-4 py-2 text-sm font-semibold transition-all duration-150 ${
                !isSignup 
                  ? "text-[var(--text-accent)] border-b-2 border-[var(--text-accent)] drop-shadow-[0_0_4px_rgba(14,210,247,0.3)]" 
                  : "text-[var(--text-dim)] opacity-70 hover:opacity-100 border-b-2 border-transparent"
              }`)}
              onClick={() => setIsSignup(false)}
            >
              Sign In
            </div>
            </div>
            
            {error && (
              <div className={tw("bg-[rgba(244,86,157,0.1)] text-[var(--text-sub-accent)] p-3 text-sm rounded border border-[rgba(244,86,157,0.2)]")}>
                {error}
              </div>
            )}
            
            <div>
              <label className={tw("block text-[var(--text-normal)] mb-1 text-sm font-medium")}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className={tw("w-full bg-[var(--bg-depth-1)] border border-[rgba(14,210,247,0.12)] rounded px-3 py-2 text-[var(--text-normal)] focus:outline-none focus:border-[rgba(14,210,247,0.5)] focus:ring-1 focus:ring-[rgba(14,210,247,0.15)] transition-all duration-150")}
              />
            </div>
            
            <div>
              <label className={tw("block text-[var(--text-normal)] mb-1 text-sm font-medium")}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={tw("w-full bg-[var(--bg-depth-1)] border border-[rgba(14,210,247,0.12)] rounded px-3 py-2 text-[var(--text-normal)] focus:outline-none focus:border-[rgba(14,210,247,0.5)] focus:ring-1 focus:ring-[rgba(14,210,247,0.15)] transition-all duration-150")}
              />
            </div>
            
            {isSignup && (
              <div>
                <label className={tw("block text-[var(--text-normal)] mb-1 text-sm font-medium")}>
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={tw("w-full bg-[var(--bg-depth-1)] border border-[rgba(14,210,247,0.12)] rounded px-3 py-2 text-[var(--text-normal)] focus:outline-none focus:border-[rgba(14,210,247,0.5)] focus:ring-1 focus:ring-[rgba(14,210,247,0.15)] transition-all duration-150")}
                />
              </div>
            )}
            
            <Button
              onClick={handleSignup}
              disabled={isLoading}
              className={tw("w-full mt-2")}
            >
              {isLoading ? (
                <span className={tw("flex items-center justify-center")}>
                  <svg className={tw("animate-spin -ml-1 mr-2 h-4 w-4")} style={{ filter: 'drop-shadow(0 0 4px rgba(14,210,247,0.4))' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className={tw("opacity-25")} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className={tw("opacity-75")} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                isSignup ? "Sign Up" : "Sign In"
              )}
            </Button>
            
            <div className={tw("flex items-center justify-center my-4")}>
              <div className={tw("flex-grow h-px bg-gradient-to-r from-[rgba(244,86,157,0.3)] via-transparent to-transparent")}></div>
              <span className={tw("mx-4 text-[var(--text-dim)] text-sm")}>or</span>
              <div className={tw("flex-grow h-px bg-gradient-to-l from-[rgba(244,86,157,0.3)] via-transparent to-transparent")}></div>
            </div>
            
            <Button 
              onClick={skipAccount}
              variant="outline"
              className={tw("w-full")}
            >
              Skip for now
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className={tw("mb-6 space-y-4")}>
            <div className={tw("mx-auto w-16 h-16 bg-[rgba(14,210,247,0.12)] rounded-full flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(14,210,247,0.3)]")}>
              <svg className={tw("w-8 h-8 text-[var(--text-accent)]")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <h4 className={tw("text-lg font-semibold text-center bg-gradient-to-r from-[var(--gradient-blue)] to-[var(--gradient-lavender)] bg-clip-text text-transparent")}>You're ready to go!</h4>
            
            <p className={tw("text-center text-[var(--text-normal)]")}>
              Zenith-AI is now set up and ready to help you organize your vault.
            </p>
            
            <div className={tw("bg-[var(--bg-depth-1)] p-4 rounded-md border border-[rgba(14,210,247,0.1)] shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]")}>
              <h4 className={tw("font-medium text-sm mb-2 bg-gradient-to-r from-[var(--gradient-blue)] to-[var(--gradient-lavender)] bg-clip-text text-transparent")}>We'll create these folders for you:</h4>
              <ul className={tw("text-sm space-y-2")}>
                <li><strong>_NoteCompanion/Inbox</strong>: Files waiting to be processed</li>
                <li><strong>_NoteCompanion/Processed</strong>: Organized files</li>
                <li><strong>_NoteCompanion/References</strong>: Reference materials</li>
              </ul>
            </div>
            
            <Button
              onClick={finish}
              className={tw("w-full mt-4")}
            >
              Finish Setup
            </Button>
          </div>
        )}

        {/* Progress indicator */}
        <div className={tw("mt-6")}>
          <div className={tw("w-full bg-[rgba(14,210,247,0.08)] rounded-full h-1.5")}>
            <div
              className={tw("bg-[var(--text-accent)] h-1.5 rounded-full shadow-[0_0_8px_rgba(14,210,247,0.6)]")}
              style={{ width: `${((step + 1) / 3) * 100}%` }}
            />
          </div>
          <div className={tw("text-xs text-[var(--text-dim)] text-right mt-1")}>
            Step {step + 1} of 3
          </div>
        </div>
      </motion.div>
    </StyledContainer>
  );
} 