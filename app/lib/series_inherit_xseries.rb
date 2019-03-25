module SeriesInheritXseries
## These are the glue methods necessary for a Series object to inherit the properties/columns now contained
## in the Xseries model after the two have been separated.

  def update(newattrs, strict = false)
    series_attrs = Series.attribute_names
    xseries_attrs = Xseries.attribute_names
    begin
      self.transaction do
          super.update(newattrs.select{|k,_| series_attrs.include? k.to_s })
        xseries.update(newattrs.select{|k,_| xseries_attrs.include? k.to_s }) unless strict
      end
    rescue
      Rails.logger.error "Model update failed for Series #{name} (id=#{id})"
    end
  end

  alias :update_attributes :update

  def update!(newattrs, strict = false)
    series_attrs = Series.attribute_names
    xseries_attrs = Xseries.attribute_names
    begin
      self.transaction do
        super.update!(newattrs.select{|k,_| series_attrs.include? k.to_s })
        xseries.update!(newattrs.select{|k,_| xseries_attrs.include? k.to_s }) unless strict
      end
    rescue
      Rails.logger.error "Model update! failed for Series #{name} (id=#{id})"
    end
  end

  alias :update_attributes! :update!

  def frequency
    xseries.frequency
  end

  def frequency=(val)
    xseries.frequency = val
  end

  def seasonally_adjusted
    xseries.seasonally_adjusted
  end

  def seasonally_adjusted=(val)
    xseries.seasonally_adjusted = val
  end

  def seasonal_adjustment
    xseries.seasonal_adjustment
  end

  def seasonal_adjustment=(val)
    xseries.seasonal_adjustment = val
  end

end
