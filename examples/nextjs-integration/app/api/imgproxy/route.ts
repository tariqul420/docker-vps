import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');
    const width = parseInt(searchParams.get('width') || '800');
    const height = parseInt(searchParams.get('height') || '600');
    const quality = parseInt(searchParams.get('quality') || '85');
    const format = searchParams.get('format') || 'webp';

    if (!imageUrl) {
      return NextResponse.json({
        error: 'Image URL is required'
      }, { status: 400 });
    }

    // This would typically generate an imgproxy URL
    // For now, return a simple response with the parameters
    return NextResponse.json({
      success: true,
      originalUrl: imageUrl,
      optimizedUrl: imageUrl, // Would be replaced with actual imgproxy URL
      parameters: {
        width,
        height,
        quality,
        format
      }
    });

  } catch (error) {
    console.error('Imgproxy API error:', error);
    return NextResponse.json({
      error: 'Failed to process image'
    }, { status: 500 });
  }
}