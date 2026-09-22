<?php

namespace App\Http\Controllers;

use App\Services\CandidateIngestionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CandidateIngestionController extends Controller
{
    public function __construct(private readonly CandidateIngestionService $service) {}

    public function store(Request $request): JsonResponse
    {
        $requestBytes = strlen($request->getContent());
        if ($requestBytes > (int) config('sibyl.ingestion.max_request_bytes') || ($request->header('Content-Length') !== null && (int) $request->header('Content-Length') > (int) config('sibyl.ingestion.max_request_bytes'))) {
            return response()->json(['message' => 'Ingestion request exceeds the configured size limit'], 413);
        }

        try {
            $payload = $request->json()->all();
            if (! is_array($payload)) {
                throw ValidationException::withMessages(['body' => 'A JSON object is required']);
            }
            $result = $this->service->ingest($payload);
        } catch (ValidationException $exception) {
            return response()->json(['message' => 'Invalid ingestion envelope', 'errors' => $exception->errors()], 422);
        }

        return response()->json($result);
    }

    public function show(string $crawlId): JsonResponse
    {
        $result = $this->service->read($crawlId);
        if ($result === null) {
            return response()->json(['message' => 'Ingestion batch not found'], 404);
        }

        return response()->json($result);
    }
}
