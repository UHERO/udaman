class ExportSeries < ActiveRecord::Base
  belongs_to :export
  belongs_to :series
end