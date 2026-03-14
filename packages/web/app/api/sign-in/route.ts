import { NextRequest, NextResponse } from "next/server";
import { clerkClient, auth } from "@clerk/nextjs/server";
import { createLicenseKeyFromUserId } from "@/app/actions";
import { createEmptyUserUsage } from "@/drizzle/schema";

export async function POST(req: NextRequest) {
  console.log('🔒 Sign-in attempt started');

  try {
    // For development mode, we'll use the current auth session if available
    console.log('Checking auth session...');
    const { userId } = await auth();

    // If we're in development mode and have a userId, use it
    if (process.env.NODE_ENV === 'development' && userId) {
      console.log('📝 Development mode - using existing session', { userId });

      console.log('Attempting to create API key for user:', userId);
      const licenseKeyResult = await createLicenseKeyFromUserId(userId);
      console.log('API key creation result:', licenseKeyResult);

      if ('error' in licenseKeyResult) {
        console.error('❌ API key creation failed:', licenseKeyResult.error);
        return NextResponse.json({
          success: false,
          error: licenseKeyResult.error,
        }, { status: 500 });
      }

      console.log('🔑 API key created successfully in dev mode');

      return NextResponse.json({
        success: true,
        apiKey: licenseKeyResult.key.key,
        licenseKey: licenseKeyResult.key.key,
        userId,
        message: "Development mode: Using current session",
      });
    }

    // For production, we'll need to sign in the user
    const { email, password } = await req.json();
    console.log('📧 Attempting sign in for email:', email);

    if (!email || !password) {
      console.warn('❌ Missing credentials', { email: !!email, password: !!password });
      return NextResponse.json({
        success: false,
        error: "Email and password are required",
      }, { status: 400 });
    }

    // get user
    console.log('🔍 Looking up user by email...');
    const usersResponse = await (await clerkClient()).users.getUserList({
      emailAddress: [email],
    });

    const users = usersResponse.data;
    console.log(`👥 Found ${users.length} matching users`);

    if (users.length === 0) {
      console.warn('❌ No user found for email:', email);
      return NextResponse.json({
        success: false,
        error: "No account found with this email",
      }, { status: 400 });
    }

    console.log('🔐 User found, generating API key...');
    const licenseKeyResult = await createLicenseKeyFromUserId(users[0].id);
    console.log('API key creation result:', licenseKeyResult);

    if ('error' in licenseKeyResult) {
      console.error('❌ API key creation failed:', licenseKeyResult.error);
      return NextResponse.json({
        success: false,
        error: licenseKeyResult.error,
      }, { status: 500 });
    }

    // Ensure user usage record exists (creates if doesn't exist, no-op if exists)
    await createEmptyUserUsage(users[0].id);

    console.log('✅ API key generated successfully');

    return NextResponse.json({
      success: true,
      apiKey: licenseKeyResult.key.key,
      licenseKey: licenseKeyResult.key.key,
      userId: users[0].id,
    });
  } catch (error) {
    console.error("❌ Error during sign in:", error);

    // Log additional error details if available
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }

    return NextResponse.json({
      success: false,
      error: "An error occurred during sign in",
    }, { status: 500 });
  }
}
