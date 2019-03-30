module SeriesInheritXseries
## These are the glue methods necessary for a Series object to inherit the properties/columns now contained
## in the Xseries model after the two have been separated.

  def updateFOOF(attributes, strict = false)
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

  #alias :update_attributes :update

  def updateFOOF!(attributes, strict = false)
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

  #alias :update_attributes! :update!

end
