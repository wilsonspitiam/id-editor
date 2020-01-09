describe('iD.actionChangePreset', function() {
    var oldPreset = iD.presetPreset('old', {tags: {old: 'true'}}),
        newPreset = iD.presetPreset('new', {tags: {new: 'true'}});

    it('changes from one preset\'s tags to another\'s', function() {
        var entity = iD.osmNode({tags: {old: 'true'}}),
            graph = iD.coreGraph([entity]),
            action = iD.actionChangePreset(entity.id, oldPreset, newPreset);
        expect(action(graph).entity(entity.id).tags).to.eql({new: 'true'});
    });

    it('adds the tags of a new preset to an entity without an old preset', function() {
        var entity = iD.osmNode(),
            graph = iD.coreGraph([entity]),
            action = iD.actionChangePreset(entity.id, null, newPreset);
        expect(action(graph).entity(entity.id).tags).to.eql({new: 'true'});
    });

    it('removes the tags of an old preset from an entity without a new preset', function() {
        var entity = iD.osmNode({tags: {old: 'true'}}),
            graph = iD.coreGraph([entity]),
            action = iD.actionChangePreset(entity.id, oldPreset, null);
        expect(action(graph).entity(entity.id).tags).to.eql({});
    });
});
