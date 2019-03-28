module SeriesInheritXseries
## These are the glue methods necessary for a Series object to inherit the properties/columns now contained
## in the Xseries model after the two have been separated.

  def update(attributes, strict = false)
    series_attrs = Series.attribute_names
    xseries_attrs = Xseries.attribute_names
    begin
      self.transaction do
          super.update(attributes.select{|k,_| series_attrs.include? k.to_s })
        xseries.update(attributes.select{|k,_| xseries_attrs.include? k.to_s }) unless strict
      end
    rescue => e
      raise "Model object update failed for Series #{name} (id=#{id}): #{e.message}"
    end
  end

  alias :update_attributes :update

  def update!(attributes, strict = false)
    series_attrs = Series.attribute_names
    xseries_attrs = Xseries.attribute_names
    begin
      self.transaction do
        super.update!(attributes.select{|k,_| series_attrs.include? k.to_s })
        xseries.update!(attributes.select{|k,_| xseries_attrs.include? k.to_s }) unless strict
      end
    rescue => e
      raise "Model object update! failed for Series #{name} (id=#{id}): #{e.message}"
    end
  end

  alias :update_attributes! :update!

  def Series.create(attributes)
    series_attrs = Series.attribute_names
    xseries_attrs = Xseries.attribute_names
    s = nil
    begin
      self.transaction do
        s = FOOFNER.create(attributes.select{|k,_| series_attrs.include? k.to_s })
        x = Xseries.update(attributes.select{|k,_| xseries_attrs.include? k.to_s }.merge(primary_series_id: s.id))
        s.update(xseries_id: x.id, true)
      end
    rescue => e
      raise "Model object creation failed for name #{attributes[:name]}: #{e.message}"
    end
    s
  end

end
