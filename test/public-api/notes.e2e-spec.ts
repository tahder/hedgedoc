/*
 * SPDX-FileCopyrightText: 2021 The HedgeDoc developers (see AUTHORS file)
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as request from 'supertest';
import { PublicApiModule } from '../../src/api/public/public-api.module';
import mediaConfigMock from '../../src/config/media.config.mock';
import { GroupsModule } from '../../src/groups/groups.module';
import { LoggerModule } from '../../src/logger/logger.module';
import { NotesModule } from '../../src/notes/notes.module';
import { PermissionsModule } from '../../src/permissions/permissions.module';
import { AuthModule } from '../../src/auth/auth.module';
import { TokenAuthGuard } from '../../src/auth/token-auth.guard';
import { MockAuthGuard } from '../../src/auth/mock-auth.guard';
import { UsersModule } from '../../src/users/users.module';
import { NotePermissionsUpdateDto } from '../../src/notes/note-permissions.dto';

describe('Notes', () => {
  let app: INestApplication;
  let content: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [mediaConfigMock],
        }),
        PublicApiModule,
        NotesModule,
        PermissionsModule,
        GroupsModule,
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: './hedgedoc-e2e-notes.sqlite',
          autoLoadEntities: true,
          synchronize: true,
          dropSchema: true,
        }),
        LoggerModule,
        AuthModule,
        UsersModule,
      ],
    })
      .overrideGuard(TokenAuthGuard)
      .useClass(MockAuthGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    content = 'This is a test note.';
  });

  it(`POST /notes`, async () => {
    const response = await request(app.getHttpServer())
      .post('/notes')
      .set('Content-Type', 'text/markdown')
      .send(content)
      .expect('Content-Type', /json/)
      .expect(201);
    expect(response.body.metadata?.id).toBeDefined();
    expect(response.body.content).toEqual(content);
  });

  describe(`GET /notes/{note}`, () => {
    it('works with an existing note', async () => {
      // Create note
      const newNoteResponse = await request(app.getHttpServer())
        .post('/notes')
        .set('Content-Type', 'text/markdown')
        .send(content)
        .expect('Content-Type', /json/)
        .expect(201);
      // Get the newly created note
      const response = await request(app.getHttpServer())
        .get(`/notes/${newNoteResponse.body.metadata?.id}`)
        .expect('Content-Type', /json/)
        .expect(200);
      expect(response.body.content).toEqual(content);
    });

    it('fails with an non-existing note', async () => {
      await request(app.getHttpServer())
        .get('/notes/i_dont_exist')
        .expect('Content-Type', /json/)
        .expect(404);
    });
  });

  describe(`POST /notes/{note}`, () => {
    it('works with a non-existing alias', async () => {
      // Create note 'test2'
      const response = await request(app.getHttpServer())
        .post('/notes/test2')
        .set('Content-Type', 'text/markdown')
        .send(content)
        .expect('Content-Type', /json/)
        .expect(201);
      expect(response.body.metadata?.id).toBeDefined();
      expect(response.body.content).toEqual(content);
    });

    it('fails with a existing alias', async () => {
      await request(app.getHttpServer())
        .post('/notes/test2')
        .set('Content-Type', 'text/markdown')
        .send(content)
        .expect('Content-Type', /json/)
        .expect(400);
    });
  });

  describe(`DELETE /notes/{note}`, () => {
    it('works with an existing alias', async () => {
      // Create note 'test3'
      await request(app.getHttpServer())
        .post('/notes/test3')
        .set('Content-Type', 'text/markdown')
        .send(content)
        .expect('Content-Type', /json/)
        .expect(201);
      // Note initially exist
      await request(app.getHttpServer()).get('/notes/test3').expect(200);
      // Delete note 'test3'
      await request(app.getHttpServer()).delete('/notes/test3').expect(200);
      // Note does not exist
      await request(app.getHttpServer()).get('/notes/test3').expect(404);
    });

    it('fails with a non-existing alias', async () => {
      await request(app.getHttpServer())
        .delete('/notes/i_dont_exist')
        .expect(404);
    });
  });

  describe(`PUT /notes/{note}`, () => {
    it('works with existing alias', async () => {
      // Create note 'test4'
      await request(app.getHttpServer())
        .post('/notes/test4')
        .set('Content-Type', 'text/markdown')
        .send(content)
        .expect('Content-Type', /json/)
        .expect(201);
      const newContent = 'Lorem ipsum';
      // Change content of note 'test4'
      const response = await request(app.getHttpServer())
        .put('/notes/test4')
        .set('Content-Type', 'text/markdown')
        .send(newContent)
        .expect(200);
      expect(response.body.content).toEqual(newContent);
    });

    it('fails with a non-existing alias', async () => {
      await request(app.getHttpServer())
        .put('/notes/i_dont_exist')
        .set('Content-Type', 'text/markdown')
        .expect('Content-Type', /json/)
        .expect(404);
    });
  });

  describe('GET /notes/{note}/metadata', () => {
    it(`returns complete metadata object`, async () => {
      // Create note 'test5'
      await request(app.getHttpServer())
        .post('/notes/test5')
        .set('Content-Type', 'text/markdown')
        .send(content)
        .expect('Content-Type', /json/)
        .expect(201);
      // Get metadata of note 'test5'
      const metadata = await request(app.getHttpServer())
        .get('/notes/test5/metadata')
        .expect(200);
      expect(typeof metadata.body.id).toEqual('string');
      expect(metadata.body.alias).toEqual('test5');
      expect(metadata.body.title).toBeNull();
      expect(metadata.body.description).toBeNull();
      expect(typeof metadata.body.createTime).toEqual('string');
      expect(metadata.body.editedBy).toEqual([]);
      expect(metadata.body.permissions.owner.userName).toEqual('hardcoded');
      expect(metadata.body.permissions.sharedToUsers).toEqual([]);
      expect(metadata.body.permissions.sharedToUsers).toEqual([]);
      expect(metadata.body.tags).toEqual([]);
      expect(typeof metadata.body.updateTime).toEqual('string');
      expect(typeof metadata.body.updateUser.displayName).toEqual('string');
      expect(typeof metadata.body.updateUser.userName).toEqual('string');
      expect(metadata.body.updateUser.email).toBeNull();
      expect(metadata.body.updateUser.photo).toEqual('');
      expect(typeof metadata.body.viewCount).toEqual('number');
      expect(metadata.body.editedBy).toEqual([]);
    });

    it('fails with non-existing alias', async () => {
      // check if a missing note correctly returns 404
      await request(app.getHttpServer())
        .get('/notes/i_dont_exist/metadata')
        .expect('Content-Type', /json/)
        .expect(404);
    });

    it('has the correct update/create dates', async () => {
      // Create note 'test5a'
      const newNote = await request(app.getHttpServer())
        .post('/notes/test5a')
        .set('Content-Type', 'text/markdown')
        .send(content)
        .expect('Content-Type', /json/)
        .expect(201);
      // Save the creation time
      const createDate = newNote.body.metadata.createTime;
      // Wait one second
      await new Promise((r) => setTimeout(r, 1000));
      // Update the note
      await request(app.getHttpServer())
        .put('/notes/test5a')
        .set('Content-Type', 'text/markdown')
        .send(content)
        .expect('Content-Type', /json/)
        .expect(200);
      // Get metadata of note 'test5a'
      const metadata = await request(app.getHttpServer())
        .get('/notes/test5a/metadata')
        .expect(200);
      expect(metadata.body.createTime).toEqual(createDate);
      expect(metadata.body.updateTime).not.toEqual(createDate);
    });
  });

  describe(`GET /notes/{note}/revisions`, () => {
    it('works with existing alias', async () => {
      // Create note 'test6'
      await request(app.getHttpServer())
        .post('/notes/test6')
        .set('Content-Type', 'text/markdown')
        .send(content)
        .expect('Content-Type', /json/)
        .expect(201);
      // Get revisions
      const response = await request(app.getHttpServer())
        .get('/notes/test6/revisions')
        .expect('Content-Type', /json/)
        .expect(200);
      expect(response.body).toHaveLength(1);
    });

    it('fails with non-existing alias', async () => {
      // check if a missing note correctly returns 404
      await request(app.getHttpServer())
        .get('/notes/i_dont_exist/revisions')
        .expect('Content-Type', /json/)
        .expect(404);
    });
  });

  describe(`GET /notes/{note}/revisions/{revision-id}`, () => {
    it('works with an existing alias', async () => {
      // Create note 'test7'
      await request(app.getHttpServer())
        .post('/notes/test7')
        .set('Content-Type', 'text/markdown')
        .send(content)
        .expect('Content-Type', /json/)
        .expect(201);
      // Get revisions
      const revisions = await request(app.getHttpServer())
        .get('/notes/test7/revisions')
        .expect('Content-Type', /json/)
        .expect(200);
      // Get first revision
      const response = await request(app.getHttpServer())
        .get('/notes/test7/revisions/' + revisions.body[0].id)
        .expect('Content-Type', /json/)
        .expect(200);
      expect(response.body.content).toEqual(content);
    });

    it('fails with non-existing alias', async () => {
      // check if a missing note correctly returns 404
      await request(app.getHttpServer())
        .get('/notes/i_dont_exist/revisions/1')
        .expect('Content-Type', /json/)
        .expect(404);
    });
  });

  describe(`GET /notes/{note}/content`, () => {
    it('works with an existing alias', async () => {
      // Create note 'test8'
      await request(app.getHttpServer())
        .post('/notes/test8')
        .set('Content-Type', 'text/markdown')
        .send(content)
        .expect('Content-Type', /json/)
        .expect(201);
      // Get content of note 'test8'
      const response = await request(app.getHttpServer())
        .get('/notes/test8/content')
        .expect('Content-Type', /text\/markdown/)
        .expect(200);
      expect(response.text).toEqual(content);
    });

    it('fails with non-existing alias', async () => {
      // check if a missing note correctly returns 404
      await request(app.getHttpServer())
        .get('/notes/i_dont_exist/content')
        .expect('Content-Type', /text\/markdown/)
        .expect(404);
    });
  });

  describe(`PUT /notes/{note}/metadata/permissions`, () => {
    const newPermissions = {
      sharedToUsers: [
        {
          username: 'hardcoded',
          canEdit: false,
        },
      ],
      sharedToGroups: [
        {
          groupname: 'everyone',
          canEdit: false,
        },
      ],
    } as NotePermissionsUpdateDto;
    it('works with existing alias', async () => {
      // Create note 'test9'
      await request(app.getHttpServer())
        .post('/notes/test9')
        .set('Content-Type', 'text/markdown')
        .send(content)
        .expect('Content-Type', /json/)
        .expect(201);
      const response = await request(app.getHttpServer())
        .put('/notes/test9/metadata/permissions')
        .set('Content-Type', 'application/json')
        .send(newPermissions)
        .expect(200);

      expect(response.body.sharedToUsers).toHaveLength(1);
      expect(response.body.sharedToUsers[0].user.userName).toEqual(
        newPermissions.sharedToUsers[0].username,
      );
      expect(response.body.sharedToUsers[0].canEdit).toEqual(
        newPermissions.sharedToUsers[0].canEdit,
      );
      expect(response.body.sharedToGroups).toHaveLength(1);
      // ToDo: activate this
      /*expect(response.body.sharedToGroups[0].group.displayName).toEqual(
        newPermissions.sharedToGroups[0].groupname,
      );*/
      expect(response.body.sharedToGroups[0].canEdit).toEqual(
        newPermissions.sharedToGroups[0].canEdit,
      );
    });

    it('fails with non-existing alias', async () => {
      // check if a missing note correctly returns 404
      await request(app.getHttpServer())
        .put('/notes/i_dont_exist/metadata/permissions')
        .set('Content-Type', 'application/json')
        .send(newPermissions)
        .expect('Content-Type', /json/)
        .expect(404);
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
