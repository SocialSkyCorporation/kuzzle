'use strict';

const should = require('should');
const BulkController = require('../../../lib/api/controller/bulk');
const { Request } = require('kuzzle-common-objects');
const KuzzleMock = require('../../mocks/kuzzle.mock');
const mockAssertions = require('../../mocks/mockAssertions');
const { NativeController } = require('../../../lib/api/controller/base');

describe('Test the bulk controller', () => {
  let controller;
  let kuzzle;
  let index;
  let collection;
  let request;

  beforeEach(() => {
    collection = 'yellow-taxi';

    index = 'nyc-open-data';

    request = new Request({
      controller: 'bulk',
      collection,
      index
    });

    kuzzle = new KuzzleMock();

    controller = mockAssertions(new BulkController(kuzzle));
  });

  describe('#constructor', () => {
    it('should inherit the base constructor', () => {
      should(controller).instanceOf(NativeController);
    });
  });

  describe('#import', () => {
    let bulkData;

    beforeEach(() => {
      bulkData = ['fake', 'data'];

      request.input.action = 'bulk';

      request.input.body = { bulkData };

      controller.publicStorage.import.resolves({
        items: ['fake', 'data'],
        errors: []
      });
    });

    it('should trigger the proper methods and resolve to a valid response', async () => {
      const response = await controller.import(request);

      should(controller.publicStorage.import)
        .be.calledWith(index, collection, bulkData, { refresh: 'false', userId: null });

      should(response).match({
        successes: ['fake', 'data'],
        errors: []
      });
    });

    it('should handle errors', async () => {
      controller.publicStorage.import.resolves({
        items: [],
        errors: ['fake', 'data']
      });

      const response = await controller.import(request);

      should(response).match({
        successes: [],
        errors: ['fake', 'data']
      });
    });
  });

  describe('#write', () => {
    let
      content,
      id;

    beforeEach(() => {
      id = 'tolkien';
      content = { name: 'Feanor', silmarils: 3 };

      request.input.action = 'write';
      request.input.body = content;
      request.input.resource._id = id;

      controller.publicStorage.createOrReplace.resolves({
        _id: id,
        _version: 1,
        _source: content,
        result: 'created'
      });
    });

    it('should createOrReplace the document without injecting meta', async () => {
      const response = await controller.write(request);

      should(kuzzle.notifier.notifyDocumentCreate).not.be.called();
      should(kuzzle.notifier.notifyDocumentReplace).not.be.called();
      should(controller.publicStorage.createOrReplace).be.calledWith(
        index,
        collection,
        id,
        content,
        { refresh: 'false', injectKuzzleMeta: false});

      should(response).match({
        _id: id,
        _version: 1,
        _source: content
      });
    });

    it('should notify if its specified', async () => {
      request.input.args.notify = true;

      await controller.write(request);

      should(kuzzle.notifier.notifyDocumentReplace).be.called();
    });
  });

  describe('#mWrite', () => {
    let
      documents,
      mCreateOrReplaceResult;

    beforeEach(() => {
      documents = [
        { name: 'Maedhros' },
        { name: 'Maglor' },
        { name: 'Celegorm' },
        { name: 'Caranthis' },
        { name: 'Curufin' },
        { name: 'Amrod' },
        { name: 'Amras' }
      ];

      request.input.action = 'write';
      request.input.body = { documents };

      mCreateOrReplaceResult = [
        { _id: 'maed', _source: { name: 'Maedhros' }, _version: 1, created: true },
        { _id: 'magl', _source: { name: 'Maglor' }, _version: 1, created: true }
      ];

      controller.publicStorage.mCreateOrReplace.resolves({
        items: mCreateOrReplaceResult,
        errors: []
      });
    });

    it('should mCreateOrReplace the document without injecting meta', async () => {
      const response = await controller.mWrite(request);

      should(kuzzle.notifier.notifyDocumentMChanges).not.be.called();
      should(controller.publicStorage.mCreateOrReplace).be.calledWith(
        index,
        collection,
        documents,
        { refresh: 'false', limits: false, injectKuzzleMeta: false });

      should(response).match({
        successes: [
          { _id: 'maed', _source: { name: 'Maedhros' }, _version: 1 },
          { _id: 'magl', _source: { name: 'Maglor' }, _version: 1 }
        ],
        errors: []
      });
    });

    it('should notify if its specified', async () => {
      request.input.args.notify = true;

      await controller.mWrite(request);

      should(kuzzle.notifier.notifyDocumentMChanges).be.calledWith(
        request, mCreateOrReplaceResult, true);
    });
  });

  describe('#deleteByQuery', async () => {
    let query;

    beforeEach(() => {
      query = {
        range: { age: { gt: 21 } }
      };

      request.input.action = 'deleteByQuery';
      request.input.args.refresh = 'wait_for';
      request.input.body = { query };

      controller.publicStorage.deleteByQuery.resolves({
        deleted: 2
      });
    });

    it('should call deleteByQuery with fetch=false', async () => {
      const response = await controller.deleteByQuery(request);

      should(controller.publicStorage.deleteByQuery).be.calledWith(
        index,
        collection,
        query,
        { refresh: 'wait_for', fetch: false });

      should(response.deleted).be.eql(2);
    });
  });
});
