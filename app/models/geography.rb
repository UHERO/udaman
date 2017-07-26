class Geography < ActiveRecord::Base

  def Geography.get_or_new_nta(attrs, add_attrs = {})
    attrs.merge!(universe: 'NTA')
    geo = Geography.find_by(attrs)
    unless geo
      parents = add_attrs[:parents] ? [add_attrs.delete(:parents)].flatten : []
      puts "!!!!!!!!!!!! ADDING GEO HANDLE #{attrs[:handle]} (parents are: |#{parents.to_s}|)"
      geo = Geography.create(attrs.merge(add_attrs))
      unless parents.empty?
        parents.each {|pid| GeoTree.create(parent_id: pid, child_id: geo.id); puts "!!!!!!!! PARENT #{pid} OF #{geo.id}" }
      end
    end
    geo
  end
end
