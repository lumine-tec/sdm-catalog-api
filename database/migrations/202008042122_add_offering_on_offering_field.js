exports.up = async function (knex, utf8 = false) {
    return knex.schema.table('offering_field', function (table) {
        table.string('offering', 45);
    });
}

exports.down = async function (knex) {
    return knex.schema.table('offering_field', function (table) {
        table.dropColumn('offering');
    });
}

