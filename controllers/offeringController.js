module.exports = (app) => {

    // [POST] => /offering
    app.post(`/offering`, async (req, res) => {
        const { headers, body } = req;
        const resp = {
            data: null,
            msg: "",
            status: 0,
            errors: []
        };

        if (!headers['authorization'] || !Number(headers['authorization'])) {
            resp.errors.push({
                location: "header",
                param: "Authorization",
                msg: "A Session ID precisa ser informada!"
            });
            return res.status(403).send(resp);
        }

        // TODO: Session verification 
        const sid = headers['authorization'];


        const obrigatorios = ["name", "external_id", "fields"];

        obrigatorios.forEach(campo => {
            req.assert(campo, `O campo '${campo}' é obrigatório!`).notEmpty();
        });


        resp.errors = req.validationErrors() || [];

        if (resp.errors.length > 0) {
            return res.status(400).send(resp);
        }

        const data = {
            id: Util.generateId(),
            name: body.name,
            external_id: body.external_id,
            fields: body.fields.map(field => {
                const obrigatorios = ['name', 'label', 'type'];

                obrigatorios.forEach(campo => {
                    if (!field[campo]) {
                        resp.errors.push({
                            location: 'field',
                            msg: `Os fields precisam ter o atributo '${campo}'`
                        });
                    }

                });

                return field;
            })
        };

        if (resp.errors.length > 0) {
            return res.status(400).send(resp);
        }

        // TODO: Verificar se a oferta já existe
        const createOffering = await Offering.Create(data);

        if (createOffering.status !== 1) {
            resp.errors.push({
                msg: createOffering.msg
            });
            return res.status(500).send(resp);
        }

        data.fields.forEach(async field => {
            const fieldObj = {
                id: Util.generateId(),
                offering: data.id,
                ...field
            };

            const createField = await OfferingField.Create(fieldObj);

            if (createField.status == 1) {
                if (field.options && Array.isArray(field.options)) {

                    field.options.forEach(option => {
                        OfferingFieldOption.Create({
                            id: Util.generateId(),
                            field: fieldObj.id,
                            label: option.label,
                            value: option.value
                        });
                    });

                }
            }

        });

        resp.status = 1;
        resp.msg = "Oferta criada com sucesso!";
        resp.data = data;
        res.send(resp);
    });

    // [GET] => /offering
    app.get(`/offering`, async (req, res) => {
        const { headers, query } = req;
        const resp = {
            data: null,
            msg: "",
            status: 0,
            errors: []
        };

        if (!headers['authorization'] || !Number(headers['authorization'])) {
            resp.errors.push({
                location: "header",
                param: "Authorization",
                msg: "A Session ID precisa ser informada!"
            });
            return res.status(403).send(resp);
        }

        const sid = headers['authorization'];

        // TODO: Session verification        
        const where = (query.where) ? `(${query.where}) AND deleted = 0` : "deleted = 0";
        const order_by = (query.order_by) ? query.order_by : "";
        const limit = (query.limit) ? query.limit : "";

        const offerings = await Offering.Get(where, order_by, limit);

        resp.data = offerings;
        resp.status = 1;
        res.send(resp);
    });

    // [GET] => /offering/:id
    app.get(`/offering/:id`, async (req, res) => {
        const { params, headers } = req;
        const resp = {
            status: 0,
            msg: "",
            data: null,
            errors: []
        };

        if (!headers['authorization'] || !Number(headers['authorization'])) {
            resp.errors.push({
                location: "header",
                param: "Authorization",
                msg: "A Session ID precisa ser informada!"
            });
            return res.status(403).send(resp);
        }

        const sid = headers['authorization'];

        // TODO: Session verification        
        const where = `id = '${params.id}' AND deleted = 0`;

        const offering = await Offering.GetFirst(where);

        if (!offering) {
            resp.errors.push({
                msg: "Oferta não encontrada"
            });
            return res.status(404).send(resp);
        }

        const fields = await OfferingField.Get(`offering = '${offering.id}'`);

        for (const field of fields) {
            const options = await OfferingFieldOption.Get(`field = '${field.id}'`);
            if (options.length > 0) {
                field.options = options;
            }
        }

        offering.fields = fields;


        resp.status = 1;
        resp.data = offering;
        res.send(resp);
    });

    // [PUT] => /offering/:id
    app.put(`/offering/:id`, async (req, res) => {
        const { params, headers, body } = req;
        const resp = {
            status: 0,
            msg: "",
            data: null,
            errors: []
        };

        if (!headers['authorization'] || !Number(headers['authorization'])) {
            resp.errors.push({
                location: "header",
                param: "Authorization",
                msg: "A Session ID precisa ser informada!"
            });
            return res.status(403).send(resp);
        }

        const sid = headers['authorization'];

        // TODO: Session verification        
        const where = `id = '${params.id}' AND deleted = 0`;

        const offering = await Offering.GetFirst(where);

        if (!offering) {
            resp.errors.push({
                msg: "Oferta não encontrada"
            });
            return res.status(404).send(resp);
        }

        if (body.fields && Array.isArray(body.fields)) {
            let done = false;
            for (const field of body.fields) {
                const fieldExists = await OfferingField.GetFirst(`id = '${field.id}'`);

                if(!field.offering || field.offering !== params.id)
                    field.offering = params.id;

                if (!fieldExists) {
                    if (!field.id)
                        field.id = Util.generateId();

                    const createField = await OfferingField.Create(field);
                    done = createField.status === 1;
                } else {
                    const data = {};
                    OfferingField.fields.forEach(f => {
                        if (field[f] !== undefined && !['id', 'options'].includes(f)) {
                            data[f] = field[f];
                        }
                    });

                    const updateField = await OfferingField.Update(data, `id = '${field.id}'`);
                    done = updateField.status === 1;
                }

                if (done && field.options && Array.isArray(field.options)) {
                    for (const option of field.options) {
                        const optionExists = await OfferingFieldOption.GetFirst(`id = '${option.id}'`);
                        
                        if(!option.field || option.field !== field.id)
                            option.field = field.id;

                        if (!optionExists) {
                            if (!option.id)
                                option.id = Util.generateId();


                            await OfferingFieldOption.Create(option);
                        } else {
                            const optionPayload = {};
                            OfferingFieldOption.fields.forEach(f => {
                                if (option[f] !== undefined && !['id'].includes(f)) {
                                    optionPayload[f] = option[f];
                                }
                            });

                            await OfferingFieldOption.Update(optionPayload, `id = '${option.id}'`);
                        }
                    }
                }
            }
        }

        const offeringPayload = {};

        Offering.fields.forEach(field => {
            if(body[field] !== undefined && !['id'].includes(field)){
                offeringPayload[field] = body[field];
            }
        });

        const updateOffering = await Offering.Update(offeringPayload, `id = '${params.id}'`);

        if(updateOffering.status !== 1){
            resp.errors.push({
                msg: 'Erro ao atualizar'
            });
            return res.status(500).send(resp);
        }

        resp.status = 1;
        resp.msg = 'Oferta atualizada com sucesso!';
        resp.data = body;
        res.send(resp);

    });

    // [DELETE] => /offering/:id
    app.delete(`/offering/:id`, async (req, res) => {
        const { params, headers, body } = req;
        const resp = {
            status: 0,
            msg: "",
            errors: []
        };

        if (!headers['authorization'] || !Number(headers['authorization'])) {
            resp.errors.push({
                location: "header",
                param: "Authorization",
                msg: "A Session ID precisa ser informada!"
            });
            return res.status(403).send(resp);
        }

        const sid = headers['authorization'];

        // TODO: Session verification        
        const where = `id = '${params.id}' AND deleted = 0`;

        const offering = await Offering.GetFirst(where);

        if (!offering) {
            resp.errors.push({
                msg: "Oferta não encontrada"
            });
            return res.status(404).send(resp);
        }

        const fields = await OfferingField.Get(`offering = '${params.id}'`);
        const fieldIds = fields.map(x => x.id);
        
        const deleteOffering = await Offering.Delete(`id = '${params.id}'`);

        if(deleteOffering.status !== 1){
            resp.errors.push({
                msg: 'Erro ao excluir oferta'
            });
            return res.status(500).send(resp);
        }

        await OfferingField.Delete(`offering = '${params.id}'`);
        await OfferingFieldOption.Delete(`field in ('${fieldIds.join(`', '`)}')`);

        resp.status = 1;
        resp.msg = "Oferta excluida com sucesso!";
        res.send(resp);
    });

};