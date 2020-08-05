class OfferingField extends Classes{

    static table = 'offering_field';
    static fields = [ 'id', 'name', 'label', 'multiple', 'type', 'offering' ];

}

module.exports = OfferingField;