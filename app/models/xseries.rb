class Xseries < ApplicationRecord
  include Cleaning
  include SeriesInheritXseries

  has_many :series, inverse_of: :xseries
  has_one :primary_series, class_name: 'Series'
  has_many :data_points, dependent: :delete_all

  def update(attributes)
    series_attrs = Series.attribute_names
    xseries_attrs = Xseries.attribute_names
    begin
      self.transaction do
        super.update(attributes.select{|k,_| series_attrs.include? k.to_s })
        xseries.update(attributes.select{|k,_| xseries_attrs.include? k.to_s })
      end
    rescue => e
      raise "Model object update failed for Xseries id=#{id}: #{e.message}"
    end
  end

end
