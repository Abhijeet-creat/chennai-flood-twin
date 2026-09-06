import { NextResponse } from "next/server";

/*
 * Development endpoint for an IMD Chennai SRI image.
 *
 * Place a real downloaded IMD SRI image at:
 *
 * public/radar/chennai-sri.jpg
 *
 * This route serves that real image to the Rain system.
 *
 * We are deliberately NOT generating rainfall data here.
 */

export async function GET() {
  try {
    const imageUrl =
      new URL(
        "/radar/chennai-sri.jpg",
        process.env.NEXT_PUBLIC_APP_URL ||
          "http://localhost:3000"
      );

    const response =
      await fetch(imageUrl, {
        cache: "no-store",
      });

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "IMD SRI development image not found.",
          expectedFile:
            "public/radar/chennai-sri.jpg",
        },
        {
          status: 404,
        }
      );
    }

    const buffer =
      await response.arrayBuffer();

    return new NextResponse(
      buffer,
      {
        status: 200,
        headers: {
          "Content-Type":
            response.headers.get(
              "content-type"
            ) ??
            "image/jpeg",

          "Cache-Control":
            "no-store, max-age=0",

          "X-Radar-Source":
            "IMD Chennai",

          "X-Radar-Product":
            "Surface Rainfall Intensity",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load SRI image.",
      },
      {
        status: 500,
      }
    );
  }
}