import sinon from "sinon";
import { Request, Response } from "express";

export function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {},
    query: {},
    path: "",
    method: "GET",
    url: "/",
    ...overrides,
  } as Request;
}

export function createMockRes(): Response {
  const res = {
    status: sinon.stub().returnsThis(),
    json: sinon.stub().returnsThis(),
    send: sinon.stub().returnsThis(),
    end: sinon.stub().returnsThis(),
    set: sinon.stub().returnsThis(),
    get: sinon.stub(),
    type: sinon.stub().returnsThis(),
  } as unknown as Response;
  return res;
}

export function createMockAlbum(overrides: Partial<any> = {}) {
  return {
    id: 1,
    title: "Test Album",
    artist_id: 1,
    artist_name: "Test Artist",
    year: 2020,
    cover_path: "abc123.jpg",
    created_at: "2024-01-01",
    ...overrides,
  };
}

export function createMockArtist(overrides: Partial<any> = {}) {
  return {
    id: 1,
    name: "Test Artist",
    created_at: "2024-01-01",
    ...overrides,
  };
}

export function createMockTrack(overrides: Partial<any> = {}) {
  return {
    id: 1,
    file: "test.mp3",
    title: "Test Track",
    artist_id: 1,
    album_id: 1,
    track_number: 1,
    disc_number: 1,
    duration: 180,
    date: "2020",
    genre: "Rock",
    ...overrides,
  };
}
